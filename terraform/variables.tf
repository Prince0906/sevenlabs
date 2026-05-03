variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "sevenlabs"
}

variable "database_url" {
  type      = string
  sensitive = true
  default   = ""
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "next_public_clerk_publishable_key" {
  type    = string
  default = ""
}

variable "replicate_api_token" {
  type      = string
  sensitive = true
  default   = ""
}
