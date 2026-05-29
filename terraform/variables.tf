variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "sevenlabs"
}

# t3.micro is Free Tier eligible (750 hrs/mo for the first 12 months).
# The app is built in CI and only *run* on the box, so 1 GB RAM is plenty.
variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key contents for access to the app box (e.g. file(\"~/.ssh/aloud.pub\"))."
}

variable "admin_ssh_cidr" {
  type        = string
  description = "CIDR allowed to SSH in. Set to your IP (e.g. 1.2.3.4/32). Defaults open — tighten this."
  default     = "0.0.0.0/0"
}
