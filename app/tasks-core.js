/* Taskbound task core: the Offload parser, copied from Pawgress (app/app.js at commit 528f356, the
   "quick add and offload" block) with its date helpers. Pure functions, no screen code: it reads
   cfg() and remCfg() only if the app defines them. Keep it in step with docs/decisions/tasks.md. */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const addDays=n=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)};
const isoDay=d=>{d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const mondayOf=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()+6)%7));
const mondayIso=d=>isoDay(mondayOf(d));
const weekNo=d=>{const m=mondayOf(d);return Math.round(Date.UTC(m.getFullYear(),m.getMonth(),m.getDate())/6048e5)};
const ordinal=n=>n+([11,12,13].includes(n%100)?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
const fmtTime=hm=>{let[a,b]=String(hm).split(':').map(Number);const ap=a<12?'am':'pm';a=a%12||12;return a+(b?':'+String(b).padStart(2,'0'):'')+ap};
function repOn(rep,d){
  if(!rep)return false;
  if(rep.dom)return d.getDate()===Math.min(rep.dom,new Date(d.getFullYear(),d.getMonth()+1,0).getDate());
  if(!rep.days||!rep.days.includes(d.getDay()))return false;
  if(rep.every===2&&rep.from){const k=weekNo(d)-weekNo(new Date(rep.from+'T12:00:00'));return k>=0&&k%2===0}
  return true;
}

/* ---------- Offload parser (from Pawgress) ---------- */
const QA_DOW={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
const QA_D='(?:mon(?:day)?|tues?(?:day)?|wed(?:nesday)?|thu(?:rs?(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const QA_MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
const QA_M='(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const QA_PL='(?:mon|tues|wednes|thurs|fri|satur|sun)days';
const QA_BIG=/\b(essay|assignment|project|report|thesis|revise|revision|study|exam|declutter|pack|packing|moving|taxes|presentation|deep clean|spring clean|clean (?:the )?(?:house|flat|room|bathroom))\b/i;
const QA_MED=/\b(clean|tidy|laundry|washing|cook|meal prep|shopping|groceries|hoover|vacuum|mop|iron|organi[sz]e|gym|workout|exercise|walk|run|plan|write|draft|homework|read)\b/i;
const QA_TINY=/\b(reply|text|message|call|ring|email|pay|book|order|buy|send|check|cancel|renew|water|bins?|meds?|medication|vitamins?|post|sign|submit|confirm|remind|stretch|drink|feed|lock|charge|upload|print)\b/i;
function qaGuess(t){return QA_BIG.test(t)?'big':QA_MED.test(t)?'medium':QA_TINY.test(t)?'tiny':(typeof cfg==='function'?cfg().defSize:'small')}
function qaGuessWhen(t){return /\bbreakfast\b/i.test(t)?'morning':/\blunch\b/i.test(t)?'afternoon':/\b(dinner|supper|bedtime|before bed|go to bed)\b/i.test(t)?'evening':null}
function qaSnap(m){return Math.max(0,Math.min(10080,Math.round(m)))}
function qaCtx(t){return qaGuessWhen(t)||(/\b(tonight|evening|night)\b/i.test(t)?'evening':/\bmorning\b/i.test(t)?'morning':/\bafternoon\b/i.test(t)?'afternoon':null)}
function qaTime(h,m,ap,ctx){
  h=+h;m=+m||0;if(m>59||h>23)return null;
  if(ap){ap=ap.toLowerCase();if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0}
  else if(h>=1&&h<=11&&(ctx==='evening'||(ctx==='afternoon'&&h<=7)))h+=12;
  else if(ctx==='morning'){}
  // a bare "at 7": marked with ? and settled in qaBare once the day is known
  else if(h>=1&&h<=11)return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+'?';
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
/* A time said without am or pm ("at 7"). For today, or no day at all: the next time it comes round (7am if that's still
   ahead, else 7pm, else 7am tomorrow). For another day or a repeat: 1 to 6 means afternoon or evening, 7 to 11 morning. */
function qaBare(x,due,rep,now=new Date()){
  if(!x||!x.endsWith('?'))return{time:x,due};
  x=x.slice(0,-1);const h=+x.slice(0,2),mi=+x.slice(3),f=n=>String(n).padStart(2,'0')+':'+String(mi).padStart(2,'0');
  if(!rep&&(!due||due===isoDay(now))){const nm=now.getHours()*60+now.getMinutes();
    if(h*60+mi>nm)return{time:f(h),due};if((h+12)*60+mi>nm)return{time:f(h+12),due};
    return due?{time:f(h+12),due}:{time:f(h),due:isoDay(new Date(now.getFullYear(),now.getMonth(),now.getDate()+1))}}
  return{time:f(h<=6?h+12:h),due};
}
/* Done things: a line in the past tense ("did the washing up", "called the GP", "I've paid the bill") or marked done
   ("done: laundry", "laundry (done)") goes straight to Done today. "to do:" in front keeps a line as a task. */
const QA_PAST=new Set(('did done went made took got gave sent paid bought ate drank wrote ran rang fed swept slept spoke sold found brought '+
  'caught taught met left kept hung held built spent won threw drew drove rode flew wore sang swam began came saw told said thought had shook woke').split(' '));
const QA_NOT_PAST=new Set('need feed weed seed speed shred bleed breed heed embed proceed succeed exceed bed red shed sled wed deed reed steed fred ahmed mohammed'.split(' '));
const QA_LEAD=/^(?:(?:i|i've|ive|i have|we|we've)\s+)?(?:(?:just|already|finally|also)\s+)?/i;
function qaPast(t){const w=(String(t).replace(QA_LEAD,'').match(/^[a-z']+/i)||[''])[0].toLowerCase();return QA_PAST.has(w)||(/^[a-z]{2,}ed$/.test(w)&&!QA_NOT_PAST.has(w))}
/* a past-tense line, with its first word also in the present, so the size guess still works ("called" -> "call") */
const QA_BASE={did:'do',done:'do',went:'go',made:'make',took:'take',got:'get',gave:'give',sent:'send',paid:'pay',bought:'buy',ate:'eat',drank:'drink',wrote:'write',ran:'run',rang:'ring',fed:'feed',swept:'sweep',sold:'sell',found:'find',brought:'bring',hung:'hang',built:'build',spent:'spend',wore:'wear'};
function qaPresent(t){return t.replace(/^([a-z']+)/i,w=>{const l=w.toLowerCase();if(QA_BASE[l])return QA_BASE[l];if(!/ed$/.test(l))return w;
  const a=l.replace(/ied$/,'y').replace(/([^aeiou])\1ed$/,'$1').replace(/ed$/,'');return a+' '+a+'e '+l.replace(/d$/,'')})}
/* Later: no day yet, kept off Today until you pick it up */
const QA_LATER=/[\s,;]*(?:#later|\bhashtag\s+later|\b(?:some\s?day|one\s+day|at\s+some\s+point|some\s?time(?!\s+(?:today|tomorrow|tonight|this|next|on|in))|eventually|when\s+i\s+(?:can|get\s+(?:a\s+)?(?:chance|time|round\s+to\s+it))|no\s+rush|for\s+later))\b/i;
function qaParse(raw){
  let s=' '+String(raw).replace(/^\s*(?:[-*•]|\d+[.)])\s+/,'').trim()+' ';
  let done=false,later=false,list='';
  {const r=s.trim();let m;
    if((m=r.match(/^(?:to\s?-?do|task)\s*:\s*(.+)$/i)))s=' '+m[1]+' ';
    else if((m=r.match(/^(?:done|did it|finished)\s*[:\-]\s*(.+)$/i))){done=true;s=' '+m[1]+' '}
    else if((m=r.match(/^(.+?)\s*(?:\(done\)|[-–]\s*done|[✓✔]+)\s*$/i))){done=true;s=' '+m[1]+' '}
    else if(qaPast(r)){done=true;s=' '+r.replace(QA_LEAD,'')+' '}}
  s=s.replace(/\ssome\s?time(?=\s+(?:today|tomorrow|tonight|this|next|on|in)\b)/i,' ');
  if(QA_LATER.test(s)){later=true;s=s.replace(QA_LATER,' ')}
  s=s.replace(/\s(?:#|hashtag\s+)(?!(?:tiny|small|medium|big)\b)(\p{L}[\p{L}\p{N}_-]{0,19})/giu,(m,w)=>{if(!list)list=w.toLowerCase();return ' '});
  let rep=null,when=null,size=null,every=false,due=null,time=null,remindAt=null,remindMin=null,wantsRemind=false;
  const ctx=qaCtx(raw),ISH='(?:\\s*-?\\s*ish)?';
  const cut=(re,fn)=>{s=s.replace(re,(...m)=>{fn(...m);return ' '})};
  const dayIdx=w=>QA_DOW[w.slice(0,3).toLowerCase()];
  const iso=n=>isoDay(addDays(n));
  cut(/\s#(tiny|small|medium|big)\b/i,(m,a)=>{size=a.toLowerCase()});
  if(!size){
    cut(/[\s,;]+(?:size[:\s]+)?(tiny|small|medium|big)(?:\s+task)?(?=\s*(?:[,;)]|$))/i,(m,a)=>{size=a.toLowerCase()});
    if(!size)cut(/\s\(\s*(tiny|small|medium|big)\s*\)/i,(m,a)=>{size=a.toLowerCase()});
    if(!size)cut(/\s(?:a\s+|an\s+)?(tiny|small|medium|big)\s+task\b/i,(m,a)=>{size=a.toLowerCase()});
    if(!size)cut(/\ssize[:\s]+(tiny|small|medium|big)\b/i,(m,a)=>{size=a.toLowerCase()});
  }
  cut(/[\s,;]*\bremind(?:\s+me)?\s+(?:(half\s+an?|an?|one|\d{1,3})\s*(min(?:ute)?s?|hours?|hrs?|days?|h|m)|(the\s+day))\s+(?:before|earlier|ahead|prior)\b/i,(m,n,u,day)=>{
    wantsRemind=true;if(day){remindMin=1440;return}
    const k=/^half/i.test(n)?.5:/^(an?|one)$/i.test(n)?1:+n;
    remindMin=qaSnap(Math.round(k*(/^h/i.test(u)?60:/^d/i.test(u)?1440:1)))});
  cut(/[\s,;]*\bremind(?:\s+me)?\s+(?:at\s+(?:the|that)\s+time|on\s+time|when\s+(?:it'?s\s+)?due)\b/i,()=>{wantsRemind=true;remindMin=0});
  cut(/[\s,;]*\bremind(?:\s+me)?\s+(?:at|for)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i,(m,h,mi,ap)=>{wantsRemind=true;remindAt=qaTime(h,mi,ap,ctx)});
  cut(/[\s,;]*\bremind\s+me\b(?=\s*(?:[,;]|$))/i,()=>{wantsRemind=true});
  cut(/^\s*remind\s+me\s+(?:to\s+)?/i,()=>{wantsRemind=true});
  // a time range ("10:30-11:30", "2pm to 3pm") keeps its start time; the end isn't stored
  s=s.replace(/(\d{1,2}:\d{2}|\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:-|–|to|until|till)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?=[\s,;]|$)/i,(m,a)=>/:|am|pm/i.test(m.slice(a.length))||/am|pm/i.test(a)?a:m);
  cut(/\s(?:at|@|by)\s+(noon|midday)\b/i,()=>{time='12:00'});
  const AT='(?:(?:at|@|by|from|around|about|at around|at about)\\s+)';
  if(!time)cut(new RegExp('\\s'+AT+'?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)\\b'+ISH,'i'),(m,h,mi,ap)=>{time=qaTime(h,mi,ap,ctx)});
  if(!time)cut(new RegExp('\\s'+AT+'?([01]?\\d|2[0-3]):([0-5]\\d)\\b'+ISH,'i'),(m,h,mi)=>{time=qaTime(h,mi,null,ctx)});
  if(!time)cut(new RegExp('\\s'+AT+'([01]?\\d|2[0-3])\\.([0-5]\\d)\\b'+ISH,'i'),(m,h,mi)=>{time=qaTime(h,mi,null,ctx)});
  if(!time)cut(new RegExp('\\s(?:at|@|around|about|at around|at about)\\s+(\\d{1,2})(?!\\s*(?:min|hour|hr|day|week|%|st\\b|nd\\b|rd\\b|th\\b|\\d|:|\\.\\d))\\b'+ISH,'i'),(m,h)=>{time=qaTime(h,0,null,ctx)});
  // every month: "every month on the 1st", "the 15th of every month", "monthly", "the last day of the month"
  const MONTHLY='(?:every\\s+month|each\\s+month|monthly)';
  cut(/\s(?:on\s+)?the\s+last\s+day\s+of\s+(?:every|each|the)\s+month\b/i,()=>{rep={dom:31}});
  if(!rep)cut(new RegExp('\\s'+MONTHLY+'\\s+on\\s+the\\s+last\\s+day\\b','i'),()=>{rep={dom:31}});
  if(!rep)cut(/\s(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\s+(?:of\s+)?(?:every|each)\s+month\b/i,(m,n)=>{if(+n>=1&&+n<=31)rep={dom:+n}});
  if(!rep)cut(new RegExp('\\s'+MONTHLY+'\\s+(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b','i'),(m,n)=>{if(+n>=1&&+n<=31)rep={dom:+n}});
  if(!rep)cut(new RegExp('\\s'+MONTHLY+'\\b','i'),()=>{rep={dom:0}});
  if(rep&&rep.dom===0){cut(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i,(m,n)=>{if(+n>=1&&+n<=31)rep.dom=+n});if(!rep.dom)rep.dom=new Date().getDate()}
  // every 2 weeks: "every other friday", "fortnightly on thursday", "every 2 weeks" (counted from the week of the next one)
  const fort=d=>{const t=new Date(),k=d==null?t.getDay():d,next=addDays((k-t.getDay()+7)%7);return{days:[k],every:2,from:mondayIso(next)}};
  if(!rep)cut(new RegExp('\\s(?:every|each)\\s+(?:other|second|2nd)\\s+('+QA_D+')s?\\b','i'),(m,w)=>{rep=fort(dayIdx(w))});
  if(!rep){let hit=false,day=null;cut(new RegExp('\\s(?:every\\s+(?:2|two)\\s+weeks|every\\s+other\\s+week|every\\s+fortnight|fortnightly|bi-?weekly)(?:\\s+on)?(?:\\s+('+QA_D+')s?)?\\b','i'),(m,w)=>{hit=true;if(w)day=dayIdx(w)});
    if(hit){if(day==null)cut(new RegExp('\\s(?:on\\s+)?('+QA_D+')s?\\b','i'),(m,w)=>{day=dayIdx(w)});rep=fort(day)}}
  cut(/\s(?:every\s*day|each\s+day|daily)\b/i,()=>{if(!rep)rep={days:[0,1,2,3,4,5,6]}});
  cut(/\s(?:every\s+weekday|weekdays)\b/i,()=>{rep={days:[1,2,3,4,5]}});
  cut(/\s(?:every\s+weekend|weekends)\b/i,()=>{rep={days:[0,6]}});
  if(!rep)cut(new RegExp('\\s(?:every|each)\\s+('+QA_D+'(?:\\s*(?:,|and|&)\\s*'+QA_D+')*)\\b','i'),(m,list)=>{
    const d=[...list.toLowerCase().matchAll(/(mon|tue|wed|thu|fri|sat|sun)/g)].map(x=>QA_DOW[x[1]]);rep={days:[...new Set(d)]}});
  if(!rep){const d=[];cut(new RegExp('\\s('+QA_PL+')\\b','gi'),(m,w)=>{d.push(dayIdx(w))});if(d.length)rep={days:[...new Set(d)]}}
  if(!rep)cut(new RegExp('\\s('+QA_D+'(?:(?:\\s*(?:,|and|&)\\s*|\\s+)'+QA_D+')+)\\b','i'),(m,list)=>{
    const d=[...list.toLowerCase().matchAll(/(mon|tue|wed|thu|fri|sat|sun)/g)].map(x=>QA_DOW[x[1]]);rep={days:[...new Set(d)]}});
  if(!rep){
    cut(/\s(?:(?:by|for|due|on)\s+)?(today|tomorrow)\b/i,(m,w)=>{due=iso(/^tom/i.test(w)?1:0)});
    if(!due)cut(/\sin\s+(\d{1,2})\s+(day|week)s?\b/i,(m,n,u)=>{due=iso(+n*(/^w/i.test(u)?7:1))});
    if(!due)cut(/\snext\s+week\b/i,()=>{due=iso(7)});
    // The next date that has that day: "the 31st" on 30 April is 31 May, "29 feb" waits for a leap year. A date that
    // never comes ("feb 30") gives null, and its words stay in the task so nothing you typed disappears.
    const onDate=(d,mo)=>{const n=new Date(),y=n.getFullYear(),td=isoDay();d=+d;if(d<1)return null;
      if(mo==null){for(let k=0;k<=12;k++){const x=new Date(y,n.getMonth()+k,d);if(x.getDate()===d&&isoDay(x)>=td)return isoDay(x)}return null}
      for(let k=0;k<=8;k++){const x=new Date(y+k,mo,d);if(x.getMonth()===mo&&isoDay(x)>=td)return isoDay(x)}return null};
    const cutDate=(re,fn)=>{s=s.replace(re,(...m)=>{const r=fn(...m);if(!r)return m[0];due=r;return ' '})};
    if(!due)cutDate(new RegExp('\\s(?:(?:on|by|for|due|before)\\s+)?(?:the\\s+)?([12]?\\d|3[01])(?:st|nd|rd|th)?\\s+(?:of\\s+)?('+QA_M+')\\b','i'),(m,d,mo)=>onDate(d,QA_MON[mo.slice(0,3).toLowerCase()]));
    if(!due)cutDate(new RegExp('\\s(?:(?:on|by|for|due|before)\\s+)?('+QA_M+')\\s+([12]?\\d|3[01])(?:st|nd|rd|th)?\\b','i'),(m,mo,d)=>onDate(d,QA_MON[mo.slice(0,3).toLowerCase()]));
    if(!due)cutDate(/\s(?:(?:on|by|for|due|before)\s+)?the\s+([12]?\d|3[01])(?:st|nd|rd|th)\b/i,(m,d)=>onDate(d,null));
    if(!due)s=s.replace(new RegExp('(\\s)(?:(by|on|for|before|due|this|next)\\s+)?('+QA_D+')\\b(?=(\\s*[^\\s]*))','i'),(m,sp,kw,w,after)=>{
      // A bare "sun" or "sat" is usually a word (sun cream, sat nav), so only treat it as a day when it is clearly one.
      if(!kw&&/^(sun|sat)$/i.test(w)&&!/^\s*(?:[,;]|at\b|@|\d|$)/i.test(after))return m;
      const t=new Date().getDay(),k=(kw||'').toLowerCase(),off=(dayIdx(w)-t+7)%7;
      due=iso(off||((k==='this'||k==='by')?0:7));return ' '});
  }
  cut(/\s(every|each|in the|this)\s+(morning|afternoon|evening)\b/i,(m,p,w)=>{when=w.toLowerCase();if(/^(every|each)$/i.test(p))every=true});
  cut(/\stonight\b/i,()=>{when='evening'});
  cut(/\s(morning|afternoon|evening)\s*$/i,(m,w)=>{when=w.toLowerCase()});
  if(every&&!rep)rep={days:[0,1,2,3,4,5,6]};
  s=s.replace(/\s*,(?:\s*,)+/g,',').replace(/\s+,/g,',').replace(/\s+/g,' ').trim().replace(/(?:\s+(?:and|on|at|in|for|every|each|the|this|by|due|before|next))+$/i,'').replace(/[\s,;:\-]+$/,'').replace(/^[\s,;:\-]+/,'');
  if(wantsRemind)s=s.replace(/^to\s+/i,'');
  let text=s||String(raw).trim();
  // Steps after a colon: "clean kitchen: dishes, sides and floor" (two or more; one part after a colon stays as it is)
  let steps=[];
  {const m=text.match(/^(.*?[^\d\s:]):\s*(.+)$/);
    if(m){const parts=m[2].split(/\s*(?:,|;|\s\+\s|\bthen\b)\s*/i).filter(Boolean),last=parts.length>1?parts.pop():null;
      if(last)parts.push(...last.split(/\s+(?:and|&)\s+/i));
      const st=parts.map(x=>x.trim().replace(/[.!]+$/,'')).filter(Boolean);
      if(st.length>1){text=m[1].trim();steps=st.slice(0,8).map(x=>(x.charAt(0).toUpperCase()+x.slice(1)).slice(0,60))}}}
  text=text.charAt(0).toUpperCase()+text.slice(1);
  {const a=qaBare(time,due,rep);time=a.time;due=a.due;const b=qaBare(remindAt,due,rep);remindAt=b.time;due=b.due}
  const remind=remindAt||time;
  if(remind&&!when){const hh=+remind.slice(0,2);when=hh<12?'morning':hh<17?'afternoon':'evening'}
  if(!when)when=qaGuessWhen(text);
  let rmin=null;
  if(remind)rmin=remindMin!=null?remindMin:(typeof remCfg==='function'?remCfg().defMin:0);
  if(done){rep=null;due=null;later=false}
  if(rep||due||remind)later=false;
  return{text:text.slice(0,80),size,guess:size?null:qaGuess(done?qaPresent(text):text),rep,when,due,remind:done?'':remind||'',remindMin:done?0:rmin||0,needTime:!done&&!remind&&(wantsRemind||remindMin!=null),steps,done,later,list};
}
/* the welcome screens only add tasks, so a line that reads as done stays a task there */
function qaExpand(line){
  const T='(\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm))';
  let m=line.match(new RegExp('^(.*?\\s)(?:at\\s+)?'+T+'\\s+and\\s+(?:at\\s+)?'+T+'(.*)$','i'));
  if(m)return [m[1]+'at '+m[2]+m[4],m[1]+'at '+m[3]+m[4]];
  m=line.match(/^(.*?\s)(every|each)\s+(morning|afternoon|evening)\s+and\s+(?:every\s+|each\s+)?(morning|afternoon|evening)\b(.*)$/i);
  if(m)return [m[1]+m[2]+' '+m[3]+m[5],m[1]+m[2]+' '+m[4]+m[5]];
  return [line];
}
/* ---------- voice Offload: one long spoken string -> one task per line ----------
   The phone's speech service returns everything said as one run-on string with no line breaks, e.g.
   "tidy living room tidy dining room clean kitchen". qaSpoken() turns spoken times into ones qaParse knows, then splits:
   1) at joining words ("next", "then", "also", "after that", "plus", counting "one / two", "first / second") and sentence ends,
   2) at "and" when a new task verb follows ("buy milk and call mum", but not "fish and chips"),
   3) before a task verb when the current task already has words of its own ("...room | tidy dining room | clean kitchen").
   Words that only say when ("every friday", "tomorrow at 6") are kept with the task they belong to. */
const SP_NUM={zero:0,oh:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50};
const SP_NW='(?:'+Object.keys(SP_NUM).join('|')+')';
const SP_N='(?:\\d{1,2}|'+SP_NW+'(?:[\\s-]+(?:one|two|three|four|five|six|seven|eight|nine))?)';
const spNum=w=>{if(/^\d+$/.test(w))return +w;return String(w).toLowerCase().split(/[\s-]+/).reduce((a,x)=>a+(SP_NUM[x]||0),0)};
// Everyday task verbs. Ones that are often nouns too ("water", "book", "text") only start a task when a word follows.
const SP_VERBS=new Set(('tidy clean wash hoover vacuum mop sweep wipe scrub dust polish declutter organise organize sort fold iron hang '+
  'buy get grab pick collect fetch drop deliver take put bring carry move empty unload load unpack pack '+
  'call ring phone email text message reply respond answer contact ask tell remind chase thank invite '+
  'book schedule cancel rearrange reschedule renew pay transfer send post mail return order top '+
  'cook bake prep make feed walk water mow weed plant prune '+
  'fix repair replace change charge install update upgrade back clear check test '+
  'write finish start do submit print sign scan file fill read revise study learn practise practice research review edit draft '+
  'go visit meet see watch attend join leave drive shower bath brush stretch exercise run swim train meditate rest '+
  'plan prepare research apply register book wrap open close lock tidy hand drop list note').split(' '));
const SP_AMBIG=new Set('water walk text book plant order post mail file change check test back hand note list top drop face shop run rest train contact answer call ring email message reply phone clean dust iron'.split(' '));
const SP_STOP=new Set('a an the to my your our his her their its some any for of with this that these those me i and or but at by from into onto about after before is are be will can must should need have has had not no'.split(' '));
const SP_PART=new Set('up out off away down over round around back on in'.split(' '));
const SP_WHEN=new RegExp('^(?:every|each|on|at|by|this|next|tomorrow|today|tonight|morning|afternoon|evening|night|noon|midday|week|weekend|weekdays?|month|daily|weekly|monthly|in|the|of|am|pm|o\'?clock|\\d{1,2}(?:[:.]\\d{2})?(?:am|pm)?|'+QA_D.slice(3,-1)+')s?$','i');
function spTimes(s){
  s=' '+s+' ';
  s=s.replace(/\b([ap])\.\s?m\.?(?=\s|,|$)/gi,(m,a)=>a.toLowerCase()+'m');
  s=s.replace(/\bthe day after tomorrow\b/gi,'in 2 days');
  s=s.replace(new RegExp('(?:\\bat\\s+)?\\b(half|quarter)\\s+(past|to)\\s+('+SP_N+')\\b','gi'),(m,q,d,n)=>{let h=spNum(n),mi=q.toLowerCase()==='half'?30:15;if(d.toLowerCase()==='to'){h=h===1?12:h-1;mi=60-mi}return 'at '+h+':'+String(mi).padStart(2,'0')});
  s=s.replace(new RegExp('(?:\\bat\\s+)?\\b('+SP_N+')\\s+o\\s?\'?\\s?clock\\b','gi'),(m,n)=>'at '+spNum(n));
  // "at six", "at six thirty", "six thirty pm", "seven am"
  s=s.replace(new RegExp('\\b(at|by|around|about|from|until|till)\\s+('+SP_N+')(?:\\s+('+SP_N+'))?(\\s*(?:am|pm))?\\b','gi'),(m,p,a,b,ap)=>{const h=spNum(a),mi=b!=null?spNum(b):null;if(h>23||(mi!=null&&mi>59))return m;return p+' '+h+(mi!=null?':'+String(mi).padStart(2,'0'):'')+(ap||'')});
  s=s.replace(new RegExp('\\b('+SP_NW+')(?:\\s+('+SP_N+'))?\\s*(am|pm)\\b','gi'),(m,a,b,ap)=>{const h=spNum(a),mi=b!=null?spNum(b):null;if(h>12||(mi!=null&&mi>59))return m;return h+(mi!=null?':'+String(mi).padStart(2,'0'):'')+ap});
  s=s.replace(new RegExp('\\b('+SP_N+')\\s+(minutes?|mins?|hours?|hrs?|days?|weeks?)\\b','gi'),(m,n,u)=>spNum(n)+' '+u);
  const ORD=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth'];
  s=s.replace(new RegExp('\\bthe\\s+(?:(twenty|thirty)[\\s-]+)?('+ORD.join('|')+')\\b','gi'),(m,t,o)=>{const n=(t?(t.toLowerCase()==='twenty'?20:30):0)+ORD.indexOf(o.toLowerCase())+1;if(n>31)return m;return 'the '+ordinal(n)});
  s=s.replace(/\b(?:it'?s|it is|that'?s|that is)\s+(?:a\s+|an\s+)?(tiny|small|medium|big)(?:\s+(?:one|task|job))?\b/gi,(m,z)=>', '+z.toLowerCase());
  s=s.replace(/\b(?:a\s+|an\s+)?(tiny|small|medium|big)\s+(?:one|job)\b/gi,(m,z)=>', '+z.toLowerCase());
  s=s.replace(/\b(tomorrow|today|this)\s+(morning|afternoon|evening)\b/gi,(m,d,w)=>(d.toLowerCase()==='this'?'':d+' ')+'in the '+w);
  return s.replace(/\s+/g,' ').trim();
}
function qaSpoken(raw){
  let s=spTimes(String(raw).replace(/[’]/g,"'").replace(/\bhash\s?tag\s+/gi,'#'));
  // 1) joining words and sentence ends become line breaks
  s=s.replace(/\s*[.!?;]+(?=\s|$)/g,'\n');
  s=s.replace(/\s*\b(?:and then|after that|and also|next task|new task|next one|then|also|plus)\b[\s,]*/gi,'\n');
  s=s.replace(new RegExp('\\s*\\bnext\\b(?!\\s+(?:week|month|year|time|'+QA_D.slice(3,-1)+'))[\\s,]*','gi'),'\n');
  s=s.replace(/(^|\s)(?:number\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|first(?:ly)?|second(?:ly)?|third(?:ly)?|fourth|fifth|finally|lastly)[\s,]+(?=([a-z']+))/gi,(m,sp,w)=>SP_VERBS.has(w.toLowerCase())?'\n':m);
  const out=[];
  for(const part of s.split('\n')){
    const words=part.replace(/,/g,' , ').split(/\s+/).filter(Boolean);
    let cur=[];
    const content=c=>c.some((w,i)=>{const l=w.toLowerCase();return w!==','&&!SP_STOP.has(l)&&!SP_PART.has(l)&&(!SP_VERBS.has(l)||(i>0&&SP_AMBIG.has(l)))});
    const onlyWhen=c=>c.every(w=>w===','||SP_WHEN.test(w));
    const flush=()=>{const c=cur.filter((w,i)=>!(w===','&&(i===0||i===cur.length-1)));if(c.length){if(out.length&&out[out.length-1].when){const p=out.pop();out.push({w:p.w.concat(c)})}else out.push({w:c,when:onlyWhen(c)})}cur=[]};
    for(let i=0;i<words.length;i++){
      const w=words[i],lw=w.toLowerCase().replace(/[^a-z']/g,''),next=(words[i+1]||'').toLowerCase().replace(/[^a-z']/g,''),prev=(cur[cur.length-1]||'').toLowerCase();
      // "remind me 30 mins before" belongs to the task before it; "remind me to ..." starts one
      const isRemind=lw==='remind'&&next==='me'&&/^(to|about)$/i.test(words[i+2]||'');
      const isVerb=(SP_VERBS.has(lw)&&lw!=='remind')||isRemind;
      const ambigOk=!SP_AMBIG.has(lw)||(next&&!SP_VERBS.has(next)&&!/^(and|or|,)$/.test(next));
      if(lw==='and'&&cur.length>=2&&content(cur)&&SP_VERBS.has(next)&&(!SP_AMBIG.has(next)||(words[i+2]&&!/^(and|or)$/i.test(words[i+2])))){flush();continue}
      const prevVerb=SP_VERBS.has(prev)&&!(SP_AMBIG.has(prev)&&cur.length>1);
      if(isVerb&&ambigOk&&cur.length&&content(cur)&&!SP_STOP.has(prev)&&!prevVerb&&prev!==','&&!/'s$/.test(prev)){flush()}
      else if(w===','&&SP_VERBS.has(next)&&cur.length&&content(cur)&&(!SP_AMBIG.has(next)||(words[i+2]&&!SP_VERBS.has((words[i+2]||'').toLowerCase())))){flush();continue}
      cur.push(w);
    }
    flush();
  }
  // a trailing "when" chunk with nothing after it goes back onto the task before it
  if(out.length>1&&out[out.length-1].when){const p=out.pop();out[out.length-1].w=out[out.length-1].w.concat(p.w)}
  return out.map(x=>x.w.join(' ').replace(/\s+,/g,',').replace(/^[,\s]+|[,\s]+$/g,'')).filter(Boolean).join('\n');
}
if(typeof window!=="undefined")window.__voice=function(t){if(window.__share)window.__share(qaSpoken(t))};
const qaKey=p=>qaNorm(p.text)+'|'+(p.remind||'')+'|'+(p.remind?'':(p.when||''));
const qaNorm=t=>String(t).toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
function qaTask(l){const p=qaParse(l);return p.done?qaParse('to do: '+String(l).trim()):p}
if(typeof module!=='undefined')module.exports={qaParse,qaExpand,qaSpoken,qaBare,qaPast,qaTask,qaNorm,isoDay,repOn};
