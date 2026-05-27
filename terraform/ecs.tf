resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048

  # AWS Learner Lab requires using the pre-existing LabRole
  execution_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"
  task_role_arn      = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"

  container_definitions = jsonencode([
    {
      name = "${var.project_name}-container"
      # Placeholder image — GitHub Actions will replace this with the real image
      # on first deploy. Using nginx with a port redirect isn't feasible, so we
      # use the ECR image if it exists, otherwise this service may fail initial
      # health checks until the CI pipeline pushes the real image.
      image     = "${aws_ecr_repository.app_repo.repository_url}:latest"
      cpu       = 1024
      memory    = 2048
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "DATABASE_URL", value = var.database_url },
        { name = "OPENAI_API_KEY", value = var.openai_api_key },
        # Auth.js
        { name = "AUTH_SECRET", value = var.auth_secret },
        { name = "AUTH_URL", value = coalesce(var.auth_url, "http://${aws_lb.main.dns_name}") },
        { name = "GOOGLE_CLIENT_ID", value = var.google_client_id },
        { name = "GOOGLE_CLIENT_SECRET", value = var.google_client_secret },
        # AWS / S3
        { name = "S3_BUCKET_NAME", value = aws_s3_bucket.audio_bucket.bucket },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AWS_ACCESS_KEY_ID", value = var.aws_access_key_id },
        { name = "AWS_SECRET_ACCESS_KEY", value = var.aws_secret_access_key },
        { name = "AWS_SESSION_TOKEN", value = var.aws_session_token }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project_name}"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app_service" {
  name            = "${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app_tg.arn
    container_name   = "${var.project_name}-container"
    container_port   = 3000
  }

  # Ignore task_definition changes so GitHub Actions can deploy new images 
  # without Terraform trying to revert back to nginx.
  lifecycle {
    ignore_changes = [task_definition]
  }
}
