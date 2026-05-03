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
      # For initial provisioning, we can use a small dummy image so the service starts
      # before our actual GitHub Action builds and pushes the real image.
      image     = "nginx:alpine"
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
        { name = "CLERK_SECRET_KEY", value = var.clerk_secret_key },
        { name = "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", value = var.next_public_clerk_publishable_key },
        { name = "REPLICATE_API_TOKEN", value = var.replicate_api_token },
        { name = "S3_BUCKET_NAME", value = aws_s3_bucket.audio_bucket.bucket },
        { name = "AWS_REGION", value = var.aws_region }
        # Note: AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN)
        # are automatically provided to the container by ECS through the task_role_arn.
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
