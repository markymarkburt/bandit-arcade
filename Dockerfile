# Static site — no build step, just serve the files.
# Minimal BusyBox httpd: tiny image, runs as a numeric non-root user on 8080.
FROM busybox:1.36-musl

# Serve the site from /www on 8080.
COPY . /www

# Numeric non-root UID (nobody is 65534 in busybox).
USER 65534

EXPOSE 8080

# BusyBox httpd: serve /www on 8080 in the foreground.
CMD ["httpd", "-f", "-v", "-p", "8080", "-h", "/www"]
