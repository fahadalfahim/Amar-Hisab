/** Interpret user-entered dates as Asia/Dhaka, independent of the device timezone. */
export function parseDhakaInput(value:string):string{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value))throw new Error('Invalid date/time');
  const date=new Date(`${value}+06:00`);
  if(Number.isNaN(date.getTime()))throw new Error('Invalid date/time');
  const back=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date).replace(' ','T');
  if(back!==value.slice(0,16))throw new Error('Invalid calendar date');
  return date.toISOString();
}
