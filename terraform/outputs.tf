output "app_public_ip" {
  description = "Elastic IP of the app box — point your domain's A record here."
  value       = aws_eip.app.public_ip
}

output "app_instance_id" {
  description = "EC2 instance ID."
  value       = aws_instance.app.id
}

output "s3_bucket_name" {
  description = "S3 bucket for audio storage (set as S3_BUCKET_NAME)."
  value       = aws_s3_bucket.audio_bucket.bucket
}

output "ssh_command" {
  description = "Convenience SSH command."
  value       = "ssh ec2-user@${aws_eip.app.public_ip}"
}
