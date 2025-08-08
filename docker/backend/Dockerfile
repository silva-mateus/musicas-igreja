# Multi-stage build para Backend Flask
FROM python:3.11-slim as builder

# Instalar dependências do sistema necessárias para build
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Configurar diretório de trabalho
WORKDIR /app

# Copiar requirements e instalar dependências Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage final - imagem de produção
FROM python:3.11-slim

# Definir UID/GID para o usuário não-root
ARG APP_USER_UID=1000
ARG APP_USER_GID=1000
RUN groupadd -r -g ${APP_USER_GID} appuser && useradd -r -g appuser -u ${APP_USER_UID} appuser

# Instalar apenas dependências runtime necessárias
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Configurar diretório de trabalho
WORKDIR /app

# Copiar dependências Python do builder
COPY --from=builder /root/.local /home/appuser/.local

# Configurar PATH para incluir pacotes Python locais
ENV PATH=/home/appuser/.local/bin:$PATH

# Copiar aplicação backend
COPY --chown=appuser:appuser backend/ .

# Criar diretórios necessários
RUN mkdir -p /app/data/logs /app/data/uploads /app/data/organized && \
    chown -R appuser:appuser /app/data

# Configurar variáveis de ambiente
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Configurar banco de dados inicial se não existir
COPY --chown=appuser:appuser pdf_organizer.db /tmp/initial_db/pdf_organizer.db

# Expor porta
EXPOSE 5000

# Trocar para usuário não-root
USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Script de entrada para inicializar banco se necessário
COPY --chown=appuser:appuser docker/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Comando de inicialização
ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "app.py"]