# Single app box. Replaces the ECS Fargate + ALB + ECR stack (~$55/mo) with a
# Free-Tier-eligible t3.micro (~$0 for 12 months, then ~$8/mo). The app runs as
# a Docker container behind Caddy (TLS); CI ships new images to it over SSH.

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "deployer" {
  key_name   = "${var.project_name}-key"
  public_key = var.ssh_public_key
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.app_sg.id]
  key_name                    = aws_key_pair.deployer.key_name
  associate_public_ip_address = true

  # Prep the box once: install Docker + the Compose plugin and create the app
  # directory. CI does the rest (ships compose/Caddyfile/.env, pulls, runs).
  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    dnf update -y
    dnf install -y docker
    systemctl enable --now docker
    usermod -aG docker ec2-user
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL https://github.com/docker/compose/releases/download/v2.39.2/docker-compose-linux-x86_64 \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    mkdir -p /opt/${var.project_name}
    chown -R ec2-user:ec2-user /opt/${var.project_name}
  EOF

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name    = "${var.project_name}-app"
    Project = var.project_name
  }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }
}
