"""
S3 Storage for Book Images
Handles uploading and managing book covers and illustrations
"""
import boto3
import os
import base64
from io import BytesIO
from PIL import Image
import uuid
from typing import Optional

class S3Storage:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        self.bucket_name = os.getenv('S3_BUCKET_NAME')
        self.cloudfront_url = os.getenv('CLOUDFRONT_URL')  # Optional CDN

        if not self.bucket_name:
            raise ValueError("S3_BUCKET_NAME environment variable not set")

    def upload_image_base64(
        self,
        base64_data: str,
        folder: str = 'images',
        optimize: bool = True,
        max_width: int = 800
    ) -> str:
        """
        Upload base64 image to S3 and return public URL

        Args:
            base64_data: Base64 string with or without data URL prefix
            folder: S3 folder path (e.g., 'covers', 'illustrations')
            optimize: Whether to compress/optimize image
            max_width: Max width for optimization (800px for Amazon KDP)

        Returns:
            Public URL to the uploaded image
        """
        # Strip data URL prefix if present
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]

        # Decode base64
        img_data = base64.b64decode(base64_data)

        # Optimize image if requested
        if optimize:
            img = Image.open(BytesIO(img_data))

            # Resize if too large
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Compress as JPEG
            buffer = BytesIO()
            img.save(buffer, format='JPEG', quality=85, optimize=True)
            img_data = buffer.getvalue()

        # Generate unique filename
        file_key = f"{folder}/{uuid.uuid4()}.jpg"

        # Upload to S3 (public access controlled by bucket policy, not ACL)
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=file_key,
            Body=img_data,
            ContentType='image/jpeg',
            CacheControl='public, max-age=31536000'  # Cache for 1 year
        )

        # Return URL (CloudFront if available, otherwise S3 direct with region)
        if self.cloudfront_url:
            return f"{self.cloudfront_url}/{file_key}"
        else:
            region = os.getenv('AWS_REGION', 'us-east-1')
            return f"https://{self.bucket_name}.s3.{region}.amazonaws.com/{file_key}"

    def delete_image(self, url: str) -> bool:
        """Delete image from S3 by URL"""
        try:
            # Extract key from URL
            if self.cloudfront_url and url.startswith(self.cloudfront_url):
                file_key = url.replace(self.cloudfront_url + '/', '')
            else:
                file_key = url.split('.amazonaws.com/')[1]

            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_key
            )
            return True
        except Exception as e:
            print(f"[S3] Delete error: {str(e)}", flush=True)
            return False
