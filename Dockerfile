FROM node:6.2
RUN mkdir -p /opt/castmydata
WORKDIR /opt/castmydata
COPY package.json index.js castmydata.js ./
COPY scripts scripts
RUN npm install
COPY lib lib
COPY public public
COPY .env.docker.example .env.example
RUN npm run setup
EXPOSE 8080
CMD ["node_modules/forever/bin/forever", "index.js"]
