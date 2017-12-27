FROM node
WORKDIR /usr/src/nodestuff
COPY package*.json ./

RUN npm install
RUN npm install -g typescript
RUN tsc

COPY . .
EXPOSE 8080
CMD ["node", "tsDist/routes.js", "mongodb://mongo:27017/"]
