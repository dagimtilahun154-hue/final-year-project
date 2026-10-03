const failure=(message,statusCode=422)=>Object.assign(new Error(message),{statusCode});
function shiftError(start,end){const s=Date.parse(start),e=Date.parse(end);if(!Number.isFinite(s)||!Number.isFinite(e)||e<=s||e-s>16*3600000) return 'Choose a valid shift of at most 16 hours.';return null;}
function transitionError(previous,next){if(next==='checkout')return previous==='checkin'?null:'Child must be checked in before pickup.';if(previous)return 'Attendance already recorded. Use the reviewed correction process.';return ['checkin','absent'].includes(next)?null:'Invalid attendance action.';}
module.exports={failure,shiftError,transitionError};
