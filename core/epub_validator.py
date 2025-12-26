"""
EPUB Validator - Marketplace Compliance Checker
Validates EPUB files for Amazon KDP, Apple Books, Google Play Books
"""
from io import BytesIO
from typing import Dict, List, Optional
import zipfile
import xml.etree.ElementTree as ET


class EPUBValidator:
    """Validate EPUB files for marketplace compliance"""

    def validate(self, epub_buffer: BytesIO) -> Dict:
        """
        Validate EPUB file structure and content

        Args:
            epub_buffer: EPUB file as BytesIO

        Returns:
            {
                'valid': bool,
                'errors': List[str],
                'warnings': List[str],
                'info': List[str],
                'score': int  # 0-100
            }
        """
        errors = []
        warnings = []
        info = []

        try:
            epub_buffer.seek(0)

            # Check if it's a valid ZIP file
            if not zipfile.is_zipfile(epub_buffer):
                return {
                    'valid': False,
                    'errors': ['File is not a valid EPUB (not a ZIP archive)'],
                    'warnings': [],
                    'info': [],
                    'score': 0
                }

            epub_buffer.seek(0)
            with zipfile.ZipFile(epub_buffer, 'r') as epub_zip:
                # 1. Check for required files
                file_list = epub_zip.namelist()

                # Must have mimetype file
                if 'mimetype' not in file_list:
                    errors.append('Missing required file: mimetype')
                else:
                    # Check mimetype content
                    mimetype = epub_zip.read('mimetype').decode('utf-8').strip()
                    if mimetype != 'application/epub+zip':
                        errors.append(f'Invalid mimetype: {mimetype}')
                    else:
                        info.append('Valid EPUB mimetype')

                # Must have META-INF/container.xml
                if 'META-INF/container.xml' not in file_list:
                    errors.append('Missing required file: META-INF/container.xml')
                else:
                    info.append('Found container.xml')

                # 2. Check container.xml structure
                if 'META-INF/container.xml' in file_list:
                    try:
                        container_xml = epub_zip.read('META-INF/container.xml')
                        root = ET.fromstring(container_xml)
                        # Look for content.opf reference
                        found_opf = False
                        for elem in root.iter():
                            if 'full-path' in elem.attrib:
                                opf_path = elem.attrib['full-path']
                                if opf_path in file_list:
                                    found_opf = True
                                    info.append(f'Found package document: {opf_path}')

                                    # 3. Validate content.opf
                                    self._validate_opf(epub_zip, opf_path, errors, warnings, info)
                                    break

                        if not found_opf:
                            errors.append('Package document (content.opf) not found')
                    except ET.ParseError as e:
                        errors.append(f'Invalid XML in container.xml: {str(e)}')

                # 4. Check for content files
                html_files = [f for f in file_list if f.endswith(('.xhtml', '.html'))]
                if len(html_files) == 0:
                    errors.append('No content files (.xhtml or .html) found')
                else:
                    info.append(f'Found {len(html_files)} content file(s)')

                # 5. Check for images (if any)
                image_files = [f for f in file_list if f.endswith(('.jpg', '.jpeg', '.png', '.gif'))]
                if len(image_files) > 0:
                    info.append(f'Found {len(image_files)} image(s)')

                    # Check image sizes (Amazon KDP recommends <127KB per image)
                    large_images = []
                    for img_file in image_files:
                        img_size = epub_zip.getinfo(img_file).file_size
                        if img_size > 127 * 1024:  # 127KB
                            large_images.append((img_file, img_size))

                    if large_images:
                        for img_file, size in large_images:
                            warnings.append(
                                f'Image {img_file} is {size // 1024}KB '
                                f'(Amazon KDP recommends <127KB)'
                            )

                # 6. Check total file size
                epub_buffer.seek(0)
                total_size = len(epub_buffer.getvalue())
                if total_size > 650 * 1024 * 1024:  # 650MB limit
                    errors.append(f'EPUB file too large: {total_size // (1024*1024)}MB (limit: 650MB)')
                elif total_size > 100 * 1024 * 1024:  # Warning at 100MB
                    warnings.append(f'EPUB file is large: {total_size // (1024*1024)}MB')
                else:
                    info.append(f'File size: {total_size // 1024}KB')

        except Exception as e:
            errors.append(f'Validation error: {str(e)}')

        # Calculate score
        score = self._calculate_score(errors, warnings, info)

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'info': info,
            'score': score
        }

    def _validate_opf(self, epub_zip: zipfile.ZipFile, opf_path: str,
                      errors: List[str], warnings: List[str], info: List[str]):
        """Validate the OPF package document"""
        try:
            opf_content = epub_zip.read(opf_path)
            root = ET.fromstring(opf_content)

            # Check for required metadata
            ns = {'opf': 'http://www.idpf.org/2007/opf',
                  'dc': 'http://purl.org/dc/elements/1.1/'}

            # Title
            titles = root.findall('.//dc:title', ns)
            if not titles:
                errors.append('Missing required metadata: title')
            else:
                info.append(f'Title: {titles[0].text}')

            # Creator/Author
            creators = root.findall('.//dc:creator', ns)
            if not creators:
                warnings.append('Missing recommended metadata: author/creator')
            else:
                info.append(f'Author: {creators[0].text}')

            # Language
            languages = root.findall('.//dc:language', ns)
            if not languages:
                errors.append('Missing required metadata: language')
            else:
                info.append(f'Language: {languages[0].text}')

            # Identifier (ISBN or unique ID)
            identifiers = root.findall('.//dc:identifier', ns)
            if not identifiers:
                warnings.append('Missing recommended metadata: identifier (ISBN)')

            # Check manifest for all referenced items
            manifest = root.find('.//opf:manifest', ns)
            if manifest is not None:
                items = manifest.findall('opf:item', ns)
                info.append(f'Manifest contains {len(items)} item(s)')
            else:
                errors.append('Missing required element: manifest')

            # Check spine (reading order)
            spine = root.find('.//opf:spine', ns)
            if spine is not None:
                itemrefs = spine.findall('opf:itemref', ns)
                info.append(f'Spine contains {len(itemrefs)} item(s)')
            else:
                errors.append('Missing required element: spine')

        except ET.ParseError as e:
            errors.append(f'Invalid XML in package document: {str(e)}')
        except Exception as e:
            errors.append(f'Error validating package document: {str(e)}')

    def _calculate_score(self, errors: List[str], warnings: List[str], info: List[str]) -> int:
        """Calculate validation score (0-100)"""
        if len(errors) > 0:
            # Deduct 20 points per error
            score = max(0, 100 - (len(errors) * 20))
        else:
            score = 100

        # Deduct 5 points per warning
        score = max(0, score - (len(warnings) * 5))

        return score


class MarketplaceReadinessChecker:
    """Check if book is ready for specific marketplaces"""

    def check_readiness(self, book_data: Dict, epub_buffer: Optional[BytesIO] = None) -> Dict:
        """
        Check readiness for all major marketplaces

        Args:
            book_data: Book data with pages, metadata, etc.
            epub_buffer: Optional pre-generated EPUB for validation

        Returns:
            Comprehensive readiness report
        """
        checks = {}

        # 1. EPUB Validation (if buffer provided)
        if epub_buffer:
            validator = EPUBValidator()
            epub_result = validator.validate(epub_buffer)
            checks['epub_valid'] = {
                'passed': epub_result['valid'],
                'score': epub_result['score'],
                'label': 'EPUB Format Valid',
                'details': epub_result.get('errors', []) + epub_result.get('warnings', [])
            }
        else:
            checks['epub_valid'] = {
                'passed': None,
                'label': 'EPUB Format Valid',
                'details': ['Generate EPUB to validate']
            }

        # 2. Has Cover
        checks['has_cover'] = {
            'passed': bool(book_data.get('cover_svg') or book_data.get('cover_image')),
            'label': 'Has Cover Image',
            'details': [] if book_data.get('cover_svg') else ['Add a cover image to improve marketability']
        }

        # 3. Has Content
        pages = book_data.get('pages', [])
        has_content = len(pages) > 0 and all(p.get('content') for p in pages)
        checks['has_content'] = {
            'passed': has_content,
            'label': f'Has Content ({len(pages)} pages)',
            'details': [] if has_content else ['Generate book pages first']
        }

        # 4. Images Optimized
        pages_with_images = [p for p in pages if p.get('illustration_url')]
        checks['has_illustrations'] = {
            'passed': len(pages_with_images) > 0 if len(pages) > 0 else None,
            'label': f'Has Illustrations ({len(pages_with_images)} pages)',
            'details': [] if len(pages_with_images) > 0 else ['Add illustrations to enhance your book (optional)'],
            'required': False
        }

        # 5. Metadata Complete
        required_metadata = ['title', 'author_name', 'description']
        missing_metadata = [field for field in required_metadata if not book_data.get(field)]
        checks['metadata_complete'] = {
            'passed': len(missing_metadata) == 0,
            'label': 'Metadata Complete',
            'details': [f'Missing: {", ".join(missing_metadata)}'] if missing_metadata else []
        }

        # 6. File Size Estimate
        # Rough estimate: ~50KB per page + ~100KB per image
        estimated_size = (len(pages) * 50 + len(pages_with_images) * 100) * 1024
        checks['file_size_ok'] = {
            'passed': estimated_size < 650 * 1024 * 1024,  # 650MB limit
            'label': f'File Size OK (~{estimated_size // 1024}KB estimated)',
            'details': [] if estimated_size < 100 * 1024 * 1024 else ['File size may be large']
        }

        # Calculate overall score
        total_checks = len([c for c in checks.values() if c.get('required', True)])
        passed_checks = len([c for c in checks.values()
                             if c.get('passed') is True and c.get('required', True)])

        if total_checks > 0:
            score = int((passed_checks / total_checks) * 100)
        else:
            score = 0

        # Determine marketplace readiness
        ready_for_kdp = all([
            checks.get('epub_valid', {}).get('passed'),
            checks['has_content']['passed'],
            checks['metadata_complete']['passed']
        ])

        ready_for_apple = all([
            checks.get('epub_valid', {}).get('passed'),
            checks['has_cover']['passed'],
            checks['metadata_complete']['passed']
        ])

        ready_for_google = ready_for_kdp  # Same requirements

        # Generate recommendations
        recommendations = self._get_recommendations(checks)

        return {
            'score': score,
            'checks': checks,
            'ready_for_kdp': ready_for_kdp,
            'ready_for_apple': ready_for_apple,
            'ready_for_google': ready_for_google,
            'recommendations': recommendations,
            'total_checks': total_checks,
            'passed_checks': passed_checks
        }

    def _get_recommendations(self, checks: Dict) -> List[str]:
        """Generate actionable recommendations based on check results"""
        recommendations = []

        for check_id, check in checks.items():
            if not check.get('passed') and check.get('required', True):
                if check_id == 'epub_valid':
                    recommendations.append('Fix EPUB validation errors before publishing')
                elif check_id == 'has_content':
                    recommendations.append('Complete book content generation')
                elif check_id == 'metadata_complete':
                    recommendations.append('Add missing book metadata (title, author, description)')
                elif check_id == 'has_cover':
                    recommendations.append('Add a professional cover image')

        if not checks.get('has_illustrations', {}).get('passed') and checks['has_content']['passed']:
            recommendations.append('Consider adding illustrations to make your book more engaging')

        if not recommendations:
            recommendations.append('Your book is ready to publish! 🎉')

        return recommendations
