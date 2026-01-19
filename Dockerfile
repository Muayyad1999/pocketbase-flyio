ARG POCKETBASE_VERSION=0.36.1
ARG ALPINE_VERSION=latest
ARG BUILD_DIR=/pb_build
ARG BUILD_TAG

# -----------------------------------------------------------------------------
# Stage 1: Build Go Binary
# -----------------------------------------------------------------------------
FROM golang:1.24-alpine AS build

ARG POCKETBASE_VERSION
ARG BUILD_DIR

RUN apk add --no-cache git

WORKDIR $BUILD_DIR

# Copy the pb_hooks directory contents to the build directory
# This directory contains the actual Go application (main.go, go.mod, hooks)
COPY pb_hooks/ .

# Initialize dependencies
# We use "tidy" to automatically resolve dependencies matching the imported packages
RUN go mod tidy

# Build the binary
# CGO_ENABLED=0 builds a statically linked binary (no libc dependency), ideal for Alpine
RUN CGO_ENABLED=0 go build -o /pocketbase/pocketbase .


# -----------------------------------------------------------------------------
# Stage 2: Final Image
# -----------------------------------------------------------------------------
FROM alpine:$ALPINE_VERSION AS final

ARG uid=1001
ARG gid=1001
ARG user=pocketbase
ARG group=pocketbase
ARG POCKETBASE_WORKDIR=/pocketbase
ARG POCKETBASE_PORT_NUMBER=8090

# ... (args from previous stage are not automatic in new stage, redefining envs)
ENV POCKETBASE_VERSION=$POCKETBASE_VERSION \
    POCKETBASE_PORT_NUMBER=$POCKETBASE_PORT_NUMBER \
    POCKETBASE_WORKDIR=$POCKETBASE_WORKDIR \
    POCKETBASE_HOME=/opt/pocketbase

EXPOSE $POCKETBASE_PORT_NUMBER

RUN apk add --no-cache ca-certificates unzip \
    && mkdir -p $POCKETBASE_HOME  \
    && mkdir -p -m 777 "$POCKETBASE_WORKDIR" \
    && addgroup -g ${gid} ${group} \
    && adduser -u ${uid} -G ${group} -s /bin/sh -D ${user}

COPY --from=build /pocketbase/pocketbase $POCKETBASE_HOME/pocketbase
COPY scripts $POCKETBASE_HOME/scripts
COPY pb_hooks $POCKETBASE_HOME/pb_hooks
COPY pb_migrations $POCKETBASE_HOME/pb_migrations

# Fix Windows line endings (CRLF -> LF) and set permissions
RUN sed -i 's/\r$//' $POCKETBASE_HOME/scripts/*.sh \
    && chmod -R 755 $POCKETBASE_HOME \
    && ln -s $POCKETBASE_HOME/pocketbase /usr/local/bin/pocketbase

# Note: Running as root for fly.io volume compatibility
# fly.io mounts volumes as root, and we need write access
WORKDIR "$POCKETBASE_WORKDIR"

ARG BUILD_TAG
ENV BUILD_TAG="$BUILD_TAG"

ENTRYPOINT ["/opt/pocketbase/scripts/entrypoint.sh"]
