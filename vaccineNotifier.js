require('dotenv').config()
const moment = require('moment');
const cron = require('node-cron');
const axios = require('axios');
const notifier = require('./notifier');
const sendEmail  = require('./sendEmail');
/**
Step 1) Enable application access on your gmail with steps given here:
 https://support.google.com/accounts/answer/185833?p=InvalidSecondFactor&visit_id=637554658548216477-2576856839&rd=1

Step 2) Enter the details in the file .env, present in the same folder

Step 3) On your terminal run: npm i && pm2 start vaccineNotifier.js

To close the app, run: pm2 stop vaccineNotifier.js && pm2 delete vaccineNotifier.js
 */

const DISTRICT = process.env.DISTRICT
const EMAIL = process.env.EMAIL
const AGE = process.env.AGE

async function main(){
    try {
        let subject = "Vaccine Availability Notifier"
        let body = "Vaccine Availability Notifier service has begun. You will be notified when the slots are available. Stay home. Stay Safe."
        // sendEmail.sendEmail(EMAIL, subject, body)
        cron.schedule('* * * * *', async () => {
             await checkAvailability();
        });
    } catch (e) {
        console.log('an error occured: ' + JSON.stringify(e, null, 2));
        throw e;
    }
}

async function checkAvailability() {

    let datesArray = await fetchNext10Days();
    datesArray.forEach(date => {
        getSlotsForDate(date);
    })
}

function getSlotsForDate(DATE) {
    let config = {
        method: 'get',
        url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict?district_id=' + DISTRICT + '&date=' + DATE,
        headers: {
            'Host': 'cdn-api.co-vin.in',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'
        }
    };

    axios(config)
        .then(function (slots) {
            let centers = slots.data.centers;
            // let sessions = centers.flatMap(center => center.sessions)
            let sessions = []
            centers.forEach(center => {
                let temp = center.sessions;
                temp.forEach(tmp => {
                    tmp.name = center.name;
                    tmp.block_name = center.block_name;
                    tmp.state_name = center.state_name;
                    tmp.pincode = center.pincode;
                    tmp.fee_type = center.fee_type;
                    sessions.push(tmp);
                });
            });
            let validSlots = sessions.filter(session => session.min_age_limit <= AGE &&  session.available_capacity > 0)
            console.log({date:DATE, validSlots: validSlots.length})
            if(validSlots.length > 0) {
                notifyMe(validSlots, DATE);
            }
        })
        .catch(function (error) {
            console.log(error);
        });
}

async function

notifyMe(validSlots, date){
    notifier.notifyUser(EMAIL, 'VACCINE AVAILABLE', validSlots, date, (err, result) => {
        if(err) {
            console.error({err});
        }
    })
};

async function fetchNext10Days(){
    let dates = [];
    let today = moment();
    for(let i = 0 ; i < 5 ; i ++ ){
        let dateString = today.format('DD-MM-YYYY')
        dates.push(dateString);
        today.add(1, 'day');
    }
    return dates;
}


main()
.then(() => {console.log('Vaccine availability checker started.')})
.catch((err) => {console.log(err)});
