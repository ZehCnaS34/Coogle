FROM ubuntu:19.04

RUN apt update && apt install -y libssl-dev

COPY target/release/ /app
COPY static app/static
COPY prod.env app/.env
COPY keys /keys

RUN echo "IdentityFile /keys/id_rsa >> /etc/ssh/ssh_config"

WORKDIR /app

EXPOSE 8000

ENTRYPOINT [ "/app/org-search" ]


