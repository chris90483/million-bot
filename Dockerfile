FROM node:14
COPY . /usr/million-bot/
WORKDIR /usr/million-bot/
RUN apt-get update -y && \
    apt-get upgrade -y && \
    apt-get install openjdk-8-jre -y && \
    npm install && \
    mkdir data

WORKDIR /usr/million-bot/antlr
RUN chmod +x antlr-4.9.2-complete.jar && \
    java -jar ./antlr-4.9.2-complete.jar -Dlanguage=JavaScript expression/Expression.g4
    
WORKDIR /usr/million-bot/
CMD ["node", "index.js"]