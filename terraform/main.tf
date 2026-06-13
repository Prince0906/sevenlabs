terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Local state keeps a solo, low-cost setup simple (no state bucket to bootstrap).
  # To collaborate or harden later: create an S3 bucket and switch to an
  # `backend "s3"` block, then `terraform init -migrate-state`.
}

provider "aws" {
  region = var.aws_region
}

# Use the account's default VPC + public subnets — no custom networking and no
# NAT gateway (a NAT would add ~$32/mo). The app box gets a public IP directly.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
