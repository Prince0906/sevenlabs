resource "aws_s3_bucket" "audio_bucket" {
  bucket_prefix = "${var.project_name}-audio-"
  force_destroy = true
}

# Versioning intentionally left OFF. Practice audio doesn't need history, and
# versioning would retain every overwrite/delete forever — slow storage creep
# and you can never truly delete. Unversioned keeps cost near zero.

# Auto-expire audio after 30 days (recordings have little long-term value) and
# clean up failed multipart uploads, so storage can't grow into a real cost.
resource "aws_s3_bucket_lifecycle_configuration" "audio_bucket_lifecycle" {
  bucket = aws_s3_bucket.audio_bucket.id

  rule {
    id     = "expire-audio"
    status = "Enabled"

    filter {} # all objects

    expiration {
      days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audio_bucket_encryption" {
  bucket = aws_s3_bucket.audio_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "audio_bucket_public_access" {
  bucket = aws_s3_bucket.audio_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
