release: python backend/manage.py migrate
web: gunicorn backend.config.asgi:application -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT