# syntax=docker/dockerfile:1
FROM alpine:3.24.1 AS downloader
ARG TARGETARCH=amd64
ARG TARGETVARIANT
ARG VERSION=0.40.4
WORKDIR /download
RUN set -eux; \
    archive="pocketbase_${VERSION}_linux_${TARGETARCH}${TARGETVARIANT}.zip"; \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${archive}"; \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/checksums.txt"; \
    grep "  ${archive}$" checksums.txt > selected.sha256; \
    sha256sum -c selected.sha256; \
    unzip "$archive" pocketbase; \
    chmod +x pocketbase
FROM alpine:3.24.1
RUN apk add --no-cache ca-certificates tzdata
COPY --from=downloader /download/pocketbase /usr/local/bin/pocketbase

ENV POCKETBASE_HOME=/opt/pocketbase POCKETBASE_WORKDIR=/pocketbase POCKETBASE_PORT_NUMBER=8090
COPY scripts/entrypoint.sh /opt/pocketbase/scripts/entrypoint.sh
COPY pb_hooks/ /opt/pocketbase/pb_hooks/
COPY pb_migrations/ /opt/pocketbase/pb_migrations/
RUN sed -i 's/\r$//' /opt/pocketbase/scripts/entrypoint.sh \
    && chmod +x /opt/pocketbase/scripts/entrypoint.sh \
    && mkdir -p /pocketbase/data /pocketbase/public
WORKDIR /pocketbase
EXPOSE 8090
ENTRYPOINT ["/opt/pocketbase/scripts/entrypoint.sh"]
