terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    # The bucket name will be passed dynamically during terraform init via GitHub Actions
    key    = "state/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# Fetch current account ID for dynamic ARNs
data "aws_caller_identity" "current" {}

# Use default VPC since AWS Learner Lab restricts VPC creation
data "aws_vpc" "default" {
  default = true
}

# Fetch subnets for the default VPC
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
