# Static site — no build step, just serve the files.
# Runs as a non-root user on port 8080 (portalcloud requirement).
FROM nginx:1.27-alpine

# Listen on 8080 instead of 80 so we don't need root to bind.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html/

# Let the unprivileged nginx user write its pid + temp paths and read the site.
RUN touch /var/run/nginx.pid \
  && chown -R nginx:nginx /var/run/nginx.pid \
  && chown -R nginx:nginx /var/cache/nginx \
  && chown -R nginx:nginx /usr/share/nginx/html

USER nginx

EXPOSE 8080
