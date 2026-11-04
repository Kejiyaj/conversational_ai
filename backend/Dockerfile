FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY alembic.ini start.sh ./
COPY alembic ./alembic
COPY app ./app
RUN chmod +x start.sh
CMD ["./start.sh"]
