console.log(Intl.DateTimeFormat().resolvedOptions().timeZone);

const nDate = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Calcutta'
  });
  
  console.log(nDate);