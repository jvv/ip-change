require('dotenv').config();

const http = require('http');
const fs = require('fs');

const mqtt = require('mqtt');
const mqClient = mqtt.connect(process.env['MQTT_ADDRESS']);

const AWS = require('aws-sdk');
const AWSaccessKeyId = process.env['AWS_ACCESS_KEY'];
const AWSsecretAccessKey = process.env['AWS_SECRET_KEY'];
const AWSregion = process.env['AWS_REGION'];
AWS.config.update({
    AWSaccessKeyId,
    AWSsecretAccessKey,
    region: AWSregion
});
const route53 = new AWS.Route53();

const knownIpFile = 'data/ip.json';


getExternalIp = () => {
    return new Promise((resolve, reject) => {
        http.get({ 'host': 'api.ipify.org', 'port': 80, 'path': '/' }, function (resp) {
            const { statusCode } = resp;
            if (statusCode !== 200) {
                return reject('ERR: API IPify response not OK');
            } else {
                resp.on('data', function (ip) {
                    console.log('api', ip);
                    return resolve(ip.toString());
                });
            }
        });
    })
}

getLastKnownIp = () => {
    return new Promise((resolve, reject) => {
        fs.readFile(knownIpFile, (err, data) => {
            if (err) {
                return reject("ERR: Can't retrieve known IP file from drive.");
            } else {
                let knownIp = JSON.parse(data).ip;
                return resolve(knownIp);
            }
        })
    })
}

saveKnownIp = (file) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(knownIpFile, JSON.stringify(file), function writeJSON(err) {
            if (err) {
                return reject(err);
            } else {
                return resolve('File written');
            }
        });
    })
}

const sendMessage = (msg) => {
    console.log(msg);
        const message = {
            message: msg
        };
        mqClient.publish(process.env['MQTT_TOPIC'], JSON.stringify(message));
        mqClient.end();
}

getHostedZoneId = () => {
    return new Promise((resolve, reject) => {
        route53.listHostedZones().promise()
            .then(res => {
                let domains = res.HostedZones;
                const zoneMatched = domains.find((domain) => {
                    return domain.Name === process.env['AWS_HOSTED_ZONE_NAME'];
                });
                resolve(zoneMatched.Id);
            }).catch(error => {
            return reject('error');
        });
    })
}

updateSubdomain = (hostedZoneId, newKnownIp) => {
    return new Promise((resolve, reject) => {
        const res = route53.changeResourceRecordSets({
            HostedZoneId: hostedZoneId,
            ChangeBatch: {
                Changes: [{
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                        Name: process.env['AWS_RECORD_NAME'],
                        Type: 'A',
                        TTL: 60 * 5,
                        ResourceRecords: [{ Value: newKnownIp }]
                    }
                }]
            }
        }).promise()
            .then(res => {
                console.log('A UPDATE', res);
                return resolve('Success');
            })
            .catch(err => {
                return reject(err);
            })
    });
}


mqClient.on('connect', function () {
    Promise.all([getLastKnownIp(), getExternalIp()]).then(data => {
        if (data[0] === data[1]) {
            // @todo = remove this message sending later.
            msg = 'No IP change';
            sendMessage(msg);
        } else {
            // notify through message queue
            msg = 'IP Addresses changed';
            sendMessage(msg);

            // // save new known IP address
            const newKnownIp = {
                "ip": data[1]
            };
            saveKnownIp(newKnownIp)
                .then(() => {
                    return getHostedZoneId()
                })
                .then((zoneId) => {
                    return updateSubdomain(zoneId, data[1])
                })
                .then(msg => {
                    sendMessage(`AWS DNS A record for ${process.env['AWS_RECORD_NAME']} successfully updated`);
                })
                .catch(err => {
                    sendMessage('ERR: Something went wrong updating AWS, you might want to look into this..');
                });
        }
    }).catch(err => {
        sendMessage(err);
    });

});
