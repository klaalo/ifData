FROM node:13.7.0-alpine
COPY . /opt/ifData/
RUN cd /opt/ifData/ifDataPut/ ; npm install ; cd .. ; mkdir logs
CMD cd /opt/ifData/ifDataPut ; node index.js >> ../logs/ifDataPut.log
