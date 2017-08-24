'use strict';
// require('dotenv').config();
const rawjs = require('raw.js');
const reddit = new rawjs("bored-bot is not boring");
const max = 100;
const min = 1;

module.exports = class Reddit {
  
  getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
  }

  getTopPosts(subreddit, random=false, index) {
  
    return new Promise((res,rej) => {

      if (!random) {
        index = (isNaN(index)) ? min : index;
        index = (index === null) ? undefined : index;
        index = (index > max) ? max : index;
        index = (index < min) ? min : index;
      } else {
        index = null;
      }


      let limit = (index) ? index : this.getRandomIntInclusive(min, max);
      console.log(limit);

      reddit.top({
          r: subreddit, //oddlysatisfying, interestingasf
          limit: limit,
        }, (err, response) => {
          if (err) {
            rej(err);
            return;
          }

          res(response.children[limit-1].data);
        }
      );

    });
  
  }


}
