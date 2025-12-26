# 🚀 Publish Wizard - One-Click to Marketplace

## Vision: From Idea to Published in Minutes

**Current Flow (Complex):**
```
Create book → Export → Download → Open in validator → Fix issues →
Upload to KDP manually → Wait for validation → Fix issues → Publish
```

**New Flow (Simple):**
```
Create book → Click "Publish" → Wizard validates → One-click to marketplace → Done! 🎉
```

---

## Phase 1: Validation & Readiness Checker ✅ (DO FIRST)

### 1.1 EPUB Validator Integration

**Built-in EPUBCheck:**
```python
# Backend: core/epub_validator.py

import subprocess
from typing import Dict, List

class EPUBValidator:
    """Validate EPUB files for marketplace compliance"""

    def validate(self, epub_file: BytesIO) -> Dict:
        """
        Validate EPUB using epubcheck

        Returns:
            {
                'valid': bool,
                'errors': List[str],
                'warnings': List[str],
                'info': List[str],
                'score': int  # 0-100
            }
        """
        # Save to temp file
        temp_file = save_to_temp(epub_file)

        # Run epubcheck
        result = subprocess.run(
            ['java', '-jar', 'epubcheck.jar', temp_file],
            capture_output=True,
            text=True
        )

        # Parse output
        errors = parse_errors(result.stdout)
        warnings = parse_warnings(result.stdout)

        # Calculate score
        score = calculate_score(errors, warnings)

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'score': score
        }
```

**API Endpoint:**
```python
@app.post("/api/books/validate-epub")
async def validate_epub(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate EPUB before publishing"""
    book_id = request.get('book_id')

    # Generate EPUB
    book_data = book_repo.get_book_with_pages(book_id, user.user_id)
    exporter = EnhancedEPUBExporter()
    epub_buffer = exporter.export_book(book_data)

    # Validate
    validator = EPUBValidator()
    result = validator.validate(epub_buffer)

    return {
        'success': True,
        'validation': result,
        'ready_to_publish': result['valid'] and result['score'] >= 90
    }
```

### 1.2 Marketplace Readiness Report

**Comprehensive Check:**
```python
class MarketplaceReadinessChecker:
    """Check if book is ready for marketplace publishing"""

    def check_readiness(self, book_data: Dict) -> Dict:
        """
        Returns comprehensive readiness report
        """
        checks = {
            'epub_valid': self.check_epub_valid(book_data),
            'has_cover': self.check_has_cover(book_data),
            'has_content': self.check_has_content(book_data),
            'images_optimized': self.check_images_optimized(book_data),
            'metadata_complete': self.check_metadata(book_data),
            'file_size_ok': self.check_file_size(book_data),
            'illustrations_embedded': self.check_illustrations(book_data),
        }

        # Calculate overall score
        passed = sum(1 for v in checks.values() if v['passed'])
        score = int((passed / len(checks)) * 100)

        # Determine readiness
        ready_for_kdp = all([
            checks['epub_valid']['passed'],
            checks['has_content']['passed'],
            checks['images_optimized']['passed']
        ])

        ready_for_apple = all([
            checks['epub_valid']['passed'],
            checks['has_cover']['passed'],
            checks['metadata_complete']['passed']
        ])

        return {
            'score': score,
            'checks': checks,
            'ready_for_kdp': ready_for_kdp,
            'ready_for_apple': ready_for_apple,
            'ready_for_google': ready_for_kdp,  # Same as KDP
            'recommendations': self.get_recommendations(checks)
        }
```

**Frontend Component:**
```typescript
// PublishReadinessCard.tsx

export default function PublishReadinessCard({ bookId }: { bookId: string }) {
  const { data: readiness } = useQuery(['readiness', bookId],
    () => booksApi.checkReadiness(bookId)
  );

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">📊 Marketplace Readiness</h3>

      {/* Score Circle */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-32 h-32">
          <svg className="transform -rotate-90">
            <circle r="58" cx="64" cy="64" stroke="#1f2937" fill="none" strokeWidth="8"/>
            <circle r="58" cx="64" cy="64" stroke="#10b981" fill="none" strokeWidth="8"
                    strokeDasharray={`${readiness.score * 3.6} 360`}/>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold">{readiness.score}%</span>
          </div>
        </div>
      </div>

      {/* Marketplace Status */}
      <div className="space-y-3">
        <ReadinessItem
          icon="📚"
          label="Amazon KDP"
          ready={readiness.ready_for_kdp}
        />
        <ReadinessItem
          icon="🍎"
          label="Apple Books"
          ready={readiness.ready_for_apple}
        />
        <ReadinessItem
          icon="📱"
          label="Google Play"
          ready={readiness.ready_for_google}
        />
      </div>

      {/* Checklist */}
      <div className="mt-6 space-y-2">
        {Object.entries(readiness.checks).map(([key, check]) => (
          <ChecklistItem key={key} check={check} />
        ))}
      </div>

      {/* Recommendations */}
      {readiness.recommendations.length > 0 && (
        <div className="mt-6 p-4 bg-yellow-500/10 rounded-lg">
          <p className="font-semibold mb-2">💡 Recommendations:</p>
          <ul className="text-sm space-y-1">
            {readiness.recommendations.map((rec, i) => (
              <li key={i}>• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 2: Publish Wizard UI 🎨

### 2.1 Multi-Step Wizard Component

**Beautiful Step-by-Step Flow:**

```typescript
// PublishWizard.tsx

const STEPS = [
  { id: 'validate', title: 'Validate Book', icon: '✅' },
  { id: 'metadata', title: 'Book Details', icon: '📝' },
  { id: 'pricing', title: 'Pricing & Rights', icon: '💰' },
  { id: 'marketplace', title: 'Choose Marketplace', icon: '🏪' },
  { id: 'publish', title: 'Publish!', icon: '🚀' },
];

export default function PublishWizard({ bookId, onClose }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState({
    metadata: {},
    pricing: {},
    marketplaces: []
  });

  return (
    <Modal isOpen onClose={onClose} size="xl">
      <div className="publish-wizard">
        {/* Progress Bar */}
        <StepProgress steps={STEPS} currentStep={currentStep} />

        {/* Step Content */}
        <div className="wizard-content">
          {currentStep === 0 && <ValidateStep bookId={bookId} />}
          {currentStep === 1 && <MetadataStep data={wizardData.metadata} />}
          {currentStep === 2 && <PricingStep data={wizardData.pricing} />}
          {currentStep === 3 && <MarketplaceStep selected={wizardData.marketplaces} />}
          {currentStep === 4 && <PublishStep wizardData={wizardData} />}
        </div>

        {/* Navigation */}
        <div className="wizard-footer">
          <button onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 0}>
            Back
          </button>
          <button onClick={() => setCurrentStep(s => s + 1)} disabled={currentStep === STEPS.length - 1}>
            Next
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

### 2.2 Validation Step

```typescript
function ValidateStep({ bookId }: { bookId: string }) {
  const validateMutation = useMutation(
    () => booksApi.validateEPUB(bookId)
  );

  useEffect(() => {
    validateMutation.mutate();
  }, []);

  if (validateMutation.isLoading) {
    return <LoadingSpinner text="Validating your book..." />;
  }

  const result = validateMutation.data;

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold">✅ Validation Results</h3>

      {/* Overall Status */}
      <div className={`p-6 rounded-lg ${result.valid ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
        <div className="flex items-center gap-3">
          {result.valid ?
            <CheckCircle className="w-8 h-8 text-green-500" /> :
            <XCircle className="w-8 h-8 text-red-500" />
          }
          <div>
            <p className="text-xl font-bold">
              {result.valid ? 'Ready to Publish!' : 'Issues Found'}
            </p>
            <p className="text-sm text-gray-400">
              Score: {result.score}/100
            </p>
          </div>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="p-4 bg-red-500/10 rounded-lg">
          <p className="font-semibold mb-2">❌ Errors (must fix):</p>
          <ul className="text-sm space-y-1">
            {result.errors.map((err, i) => (
              <li key={i} className="text-red-400">• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="p-4 bg-yellow-500/10 rounded-lg">
          <p className="font-semibold mb-2">⚠️ Warnings (recommended to fix):</p>
          <ul className="text-sm space-y-1">
            {result.warnings.map((warn, i) => (
              <li key={i} className="text-yellow-400">• {warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Success */}
      {result.valid && (
        <div className="p-4 bg-green-500/10 rounded-lg">
          <p className="font-semibold mb-2">✅ All checks passed!</p>
          <ul className="text-sm space-y-1">
            <li>• EPUB format valid</li>
            <li>• Images optimized</li>
            <li>• Accessibility compliant</li>
            <li>• Ready for all marketplaces</li>
          </ul>
        </div>
      )}
    </div>
  );
}
```

### 2.3 Metadata Step

```typescript
function MetadataStep({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold">📝 Book Details</h3>
      <p className="text-gray-400">These details will appear on marketplace listings</p>

      <div className="space-y-4">
        <div>
          <label>Book Title *</label>
          <input
            value={data.title}
            onChange={e => onChange({ ...data, title: e.target.value })}
            className="input-field"
            placeholder="The Adventures of Sparkle"
          />
        </div>

        <div>
          <label>Subtitle (optional)</label>
          <input
            value={data.subtitle}
            onChange={e => onChange({ ...data, subtitle: e.target.value })}
            className="input-field"
            placeholder="A Dragon's Journey"
          />
        </div>

        <div>
          <label>Description *</label>
          <textarea
            value={data.description}
            onChange={e => onChange({ ...data, description: e.target.value })}
            className="input-field min-h-32"
            placeholder="An enchanting tale about..."
          />
          <p className="text-xs text-gray-500 mt-1">
            {data.description?.length || 0} / 4000 characters
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>Author Name *</label>
            <input
              value={data.author}
              onChange={e => onChange({ ...data, author: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label>Language</label>
            <select
              value={data.language}
              onChange={e => onChange({ ...data, language: e.target.value })}
              className="input-field"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
        </div>

        <div>
          <label>Categories (up to 3) *</label>
          <CategorySelector
            selected={data.categories}
            onChange={cats => onChange({ ...data, categories: cats })}
          />
        </div>

        <div>
          <label>Keywords (for search)</label>
          <input
            value={data.keywords}
            onChange={e => onChange({ ...data, keywords: e.target.value })}
            className="input-field"
            placeholder="dragon, adventure, children's book"
          />
        </div>
      </div>
    </div>
  );
}
```

### 2.4 Marketplace Selection Step

```typescript
function MarketplaceStep({ selected, onChange }: Props) {
  const marketplaces = [
    {
      id: 'kdp',
      name: 'Amazon KDP',
      icon: '📚',
      description: 'Largest marketplace - Kindle, paperback, hardcover',
      pros: ['70% royalty option', 'Huge audience', 'Print on demand'],
      integration: 'api' // or 'manual'
    },
    {
      id: 'apple',
      name: 'Apple Books',
      icon: '🍎',
      description: 'Premium marketplace - iPad, iPhone, Mac',
      pros: ['70% royalty', 'Premium audience', 'Global distribution'],
      integration: 'manual' // Coming soon: 'api'
    },
    {
      id: 'google',
      name: 'Google Play Books',
      icon: '📱',
      description: 'Android users worldwide',
      pros: ['52% royalty', 'Android ecosystem', 'Auto-pricing'],
      integration: 'manual'
    },
    {
      id: 'kobo',
      name: 'Kobo Writing Life',
      icon: '📖',
      description: 'Growing international marketplace',
      pros: ['70% royalty', 'Strong in Canada/UK', 'DRM-free'],
      integration: 'manual'
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold">🏪 Choose Marketplaces</h3>
      <p className="text-gray-400">Select where you want to publish (you can publish to multiple)</p>

      <div className="space-y-3">
        {marketplaces.map(marketplace => (
          <MarketplaceCard
            key={marketplace.id}
            marketplace={marketplace}
            selected={selected.includes(marketplace.id)}
            onToggle={() => {
              if (selected.includes(marketplace.id)) {
                onChange(selected.filter(id => id !== marketplace.id));
              } else {
                onChange([...selected, marketplace.id]);
              }
            }}
          />
        ))}
      </div>

      {selected.length > 0 && (
        <div className="p-4 bg-brand-500/10 rounded-lg">
          <p className="font-semibold mb-2">✅ Selected: {selected.length} marketplace(s)</p>
          <p className="text-sm text-gray-400">
            Your book will be available on {selected.map(id =>
              marketplaces.find(m => m.id === id)?.name
            ).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 3: Direct KDP Integration 🔗

### 3.1 Amazon KDP API Integration

**Backend Integration:**
```python
# core/kdp_integration.py

from typing import Dict, Optional
import httpx

class KDPIntegration:
    """Amazon Kindle Direct Publishing API integration"""

    def __init__(self, api_key: str, secret: str):
        self.api_key = api_key
        self.secret = secret
        self.base_url = "https://kdp.amazon.com/api/v1"

    async def create_book(self, book_data: Dict) -> Dict:
        """
        Create book on Amazon KDP

        Args:
            book_data: {
                'title': str,
                'subtitle': str,
                'description': str,
                'author': str,
                'categories': List[str],
                'keywords': str,
                'epub_file': BytesIO,
                'cover_image': BytesIO,
                'pricing': Dict,
                'territories': List[str]
            }

        Returns:
            {
                'success': bool,
                'book_id': str,  # KDP book ID
                'asin': str,     # Amazon Standard Identification Number
                'status': str,   # 'draft', 'in_review', 'live'
                'url': str       # Link to KDP dashboard
            }
        """
        # Upload EPUB
        epub_url = await self._upload_file(
            book_data['epub_file'],
            'manuscript'
        )

        # Upload cover
        cover_url = await self._upload_file(
            book_data['cover_image'],
            'cover'
        )

        # Create book metadata
        payload = {
            'title': book_data['title'],
            'subtitle': book_data.get('subtitle'),
            'description': book_data['description'],
            'contributors': [{
                'name': book_data['author'],
                'role': 'Author'
            }],
            'language': book_data.get('language', 'en'),
            'categories': book_data['categories'],
            'keywords': book_data['keywords'].split(','),
            'manuscript_url': epub_url,
            'cover_url': cover_url,
            'pricing': book_data['pricing'],
            'publishing_rights': book_data.get('rights', 'worldwide'),
            'age_range': book_data.get('age_range')
        }

        # Submit to KDP
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/books",
                json=payload,
                headers=self._get_auth_headers()
            )
            response.raise_for_status()
            result = response.json()

        return {
            'success': True,
            'book_id': result['id'],
            'asin': result.get('asin'),
            'status': result['status'],
            'url': f"https://kdp.amazon.com/en_US/bookshelf/{result['id']}"
        }
```

**API Endpoint:**
```python
@app.post("/api/publish/amazon-kdp")
async def publish_to_amazon_kdp(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Publish book directly to Amazon KDP"""
    book_id = request.get('book_id')
    kdp_settings = request.get('kdp_settings')

    # Get book data
    book_data = book_repo.get_book_with_pages(book_id, user.user_id)

    # Generate EPUB
    exporter = EnhancedEPUBExporter()
    epub_buffer = exporter.export_book(book_data)

    # Get user's KDP credentials (stored securely)
    kdp_creds = user_repo.get_kdp_credentials(user.user_id)
    if not kdp_creds:
        raise HTTPException(
            status_code=400,
            detail="Please connect your Amazon KDP account first"
        )

    # Initialize KDP integration
    kdp = KDPIntegration(
        api_key=kdp_creds['api_key'],
        secret=kdp_creds['secret']
    )

    # Publish to KDP
    result = await kdp.create_book({
        'title': kdp_settings['title'],
        'subtitle': kdp_settings.get('subtitle'),
        'description': kdp_settings['description'],
        'author': kdp_settings['author'],
        'categories': kdp_settings['categories'],
        'keywords': kdp_settings['keywords'],
        'epub_file': epub_buffer,
        'cover_image': get_cover_image(book_data),
        'pricing': kdp_settings['pricing'],
        'territories': kdp_settings.get('territories', ['US', 'GB', 'CA'])
    })

    # Log publication
    usage_repo.log_action(
        user_id=user.user_id,
        action_type='published_to_kdp',
        book_id=book_id,
        metadata={'kdp_book_id': result['book_id'], 'asin': result.get('asin')}
    )

    return {
        'success': True,
        'message': 'Successfully published to Amazon KDP!',
        'kdp_url': result['url'],
        'asin': result.get('asin'),
        'status': result['status']
    }
```

---

## Phase 4: Quick Publish Button 🚀

### Add to BookView & Editor:

```typescript
// In BookView.tsx or Editor.tsx

<button
  onClick={() => setShowPublishWizard(true)}
  className="btn-primary flex items-center gap-2"
  disabled={!book.is_completed}
>
  <Rocket className="w-5 h-5" />
  Publish to Marketplace
</button>

{showPublishWizard && (
  <PublishWizard
    bookId={book.book_id}
    onClose={() => setShowPublishWizard(false)}
    onPublish={(result) => {
      toast.success(`Published to ${result.marketplace}!`);
      // Show success modal with links
    }}
  />
)}
```

---

## Phase 5: Pre-Publish Checklist ✅

**Automated Checklist:**
```typescript
const PRE_PUBLISH_CHECKLIST = [
  {
    id: 'content_complete',
    label: 'Book has all pages generated',
    check: (book) => book.pages_generated >= book.target_pages
  },
  {
    id: 'has_illustrations',
    label: 'At least one illustration added (recommended)',
    check: (book) => book.pages.some(p => p.illustration_url),
    required: false
  },
  {
    id: 'epub_valid',
    label: 'EPUB passes validation',
    check: async (book) => {
      const result = await validateEPUB(book.book_id);
      return result.valid;
    }
  },
  {
    id: 'metadata_complete',
    label: 'Book metadata filled out',
    check: (book) => book.title && book.author_name && book.description
  },
  {
    id: 'cover_exists',
    label: 'Book has cover image',
    check: (book) => !!book.cover_svg
  },
  {
    id: 'file_size_ok',
    label: 'File size under 650MB',
    check: async (book) => {
      const size = await getExportSize(book.book_id);
      return size < 650 * 1024 * 1024;
    }
  }
];
```

---

## Implementation Priority

### Week 1: Foundation (DO NOW)
1. ✅ **EPUB Validator** - Add epubcheck integration
2. ✅ **Readiness Checker** - Backend + Frontend
3. ✅ **Publish Button** - Add to UI

### Week 2: Wizard
4. **Publish Wizard UI** - Multi-step flow
5. **Metadata Form** - Beautiful UX
6. **Validation Step** - Show results

### Week 3: Integration
7. **KDP Integration** - Direct publishing
8. **OAuth Flow** - Connect KDP account
9. **Success Tracking** - Analytics

### Week 4: Polish
10. **Success Animations** - Confetti on publish!
11. **Email Notifications** - "Your book is live!"
12. **Dashboard Stats** - Show published books

---

## User Flow Example

**Before (Complex - 30+ minutes):**
1. Create book ✍️
2. Export to EPUB 📥
3. Download to computer 💾
4. Open in validator 🔍
5. Fix issues ⚙️
6. Re-export 📥
7. Go to KDP website 🌐
8. Create account ✍️
9. Fill out 20+ fields 📝
10. Upload EPUB ⬆️
11. Wait for validation ⏳
12. Fix more issues 🔧
13. Finally publish 🎉

**After (Simple - 2 minutes):**
1. Create book with AI ✨
2. Click "Publish" button 🚀
3. Wizard validates ✅
4. Fill out 5 fields 📝
5. Click "Publish to Amazon" 🎯
6. Done! Book is live 🎉

---

## Technical Requirements

### Backend:
- `epubcheck.jar` file (or Python wrapper)
- Amazon KDP API credentials
- Secure credential storage
- OAuth2 flow for user accounts

### Frontend:
- Multi-step wizard component
- Progress tracking
- Success animations
- Error handling

### Infrastructure:
- Job queue for publishing (async)
- Webhook handlers for status updates
- Email service for notifications

---

## Benefits

### For Users:
- ✅ **10x faster** to publish
- ✅ **No technical knowledge** needed
- ✅ **Automatic validation** prevents errors
- ✅ **One-click publishing** to Amazon
- ✅ **Professional results** every time

### For Platform:
- ✅ **Higher conversion** (more users publish)
- ✅ **Better retention** (easier = stickier)
- ✅ **Viral potential** (success stories)
- ✅ **Revenue opportunity** (pro feature)
- ✅ **Market differentiation** (unique feature)

---

## Pricing Model

**Free Tier:**
- EPUB validation ✅
- Readiness checker ✅
- Manual export ✅

**Pro Tier ($9.99/month):**
- One-click KDP publishing 🚀
- Multi-marketplace publishing 📚
- Automatic metadata optimization 🎯
- Publishing analytics 📊
- Priority support 💬

---

## Success Metrics

Track:
- % of users who click "Publish"
- % who complete the wizard
- % who successfully publish to KDP
- Time from book creation to publication
- User satisfaction scores

Goal: **80% of completed books get published to at least one marketplace**

---

**Ready to implement?** This would make your platform the **easiest way to publish AI-generated books** - a true competitive advantage! 🚀
