// The campus's official (verified) clubs. Only these can post official events.
export const CLUBS = [
  { name: 'International Students Association', short: 'ISA', cat: 'Culture', blurb: 'Welcome events and trips for students from abroad' },
  { name: 'Running Club', short: 'Run', cat: 'Sport', blurb: 'Social runs for every pace, twice a week' },
  { name: 'Football Club', short: 'FC', cat: 'Sport', blurb: 'Five-a-side and casual kickabouts' },
  { name: 'Photography Club', short: 'Photo', cat: 'Culture', blurb: 'Photo walks, workshops and an end-of-year show' },
  { name: 'Language Exchange Society', short: 'Lang', cat: 'Languages', blurb: 'Swap languages over coffee, all levels welcome' },
  { name: 'Board Games Society', short: 'Games', cat: 'Games', blurb: 'Weekly game nights with a big shared collection' },
  { name: 'Hiking & Outdoors Club', short: 'Hike', cat: 'Walks', blurb: 'Day hikes and weekend trips into the mountains' },
  { name: 'Debate Society', short: 'Debate', cat: 'Study', blurb: 'Friendly debates and public speaking practice' },
  { name: 'Cooking Club', short: 'Cook', cat: 'Food', blurb: 'Cook and eat together, recipes from everywhere' },
  { name: 'Music Society', short: 'Music', cat: 'Culture', blurb: 'Jam sessions, choir and open mic nights' },
  { name: 'Business Club', short: 'Biz', cat: 'Study', blurb: 'Talks, networking and case competitions' },
  { name: 'Oenology Society', short: 'Wine', cat: 'Culture', blurb: 'Wine tastings, members only' }
];
export const clubInfo = name => CLUBS.find(c => c.name === name);
