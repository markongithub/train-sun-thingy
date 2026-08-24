FROM node:latest
WORKDIR /usr/src/nodestuff
COPY package*.json ./

RUN npm install
RUN npm install -g typescript

COPY . .

RUN tsc

EXPOSE ${PORT}
CMD ["node", "dist/src/routes.js"]
