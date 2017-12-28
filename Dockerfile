FROM node
WORKDIR /usr/src/nodestuff
COPY package*.json ./

RUN npm install
RUN npm install -g typescript

COPY . .

RUN tsc

EXPOSE 8080
CMD ["node", "tsDist/routes.js"]
