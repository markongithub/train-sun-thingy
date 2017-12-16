FROM node
WORKDIR /usr/src/nodestuff
COPY package*.json ./

RUN npm install

COPY . .
EXPOSE 8080
CMD ["node", "routes.js"]
