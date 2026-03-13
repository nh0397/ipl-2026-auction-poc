-- Rulebook Seed
INSERT INTO public.auction_settings (id, content) 
VALUES ('current_rules', '<h1>IPL 2026 Auction & Scoring Rules</h1>
<h3>Auction/Bonus Rules</h3>
<ul>
  <li><strong>Final Authority</strong>: In case of any dispute, organizer''s decision will be <strong>FINAL</strong>.</li>
  <li><strong>Point-Boosters</strong>: 
    <ul>
      <li>3 Point-Boosters per team -> 3X Points earned for both the matches on the day.</li>
      <li>These boosters can be used on Double Header Days only and maximum 2 times in a month (April/May).</li>
      <li>No other bonus* will apply on the day bonus is used. NO OTHER BONUS WHATSOEVER. 2X Dream11 Points ONLY. Not even Cap/VC Bonus.</li>
      <li>*Icon Player bonus will apply on booster days.</li>
    </ul>
  </li>
  <li><strong>Revenge Match Booster</strong>:
    <ul>
      <li>Once per opponent team per month (April and May), you can declare a “revenge match” in league stage; if you outscore that opponent on that day, you gain +200 bonus, if you lose you get -100.</li>
      <li>This can not be on the days either of the team has a 2X Booster Day.</li>
      <li>Be civil and do not fight over the same day to be your "revenge day".</li>
      <li>So, each team gets 3 Revenge Matches each (1 per opponent) for April and May.</li>
    </ul>
  </li>
  <li><strong>Squad Size</strong>: Min 23 players to be bought by each team; MAX 28.</li>
  <li><strong>Team Constraints</strong>: MAX 6 players can be bought from a team, MIN 1 player from each team to be bought.</li>
  <li><strong>Selection</strong>: You have complete freedom when it comes to selecting players for your team, as there are no limitations or requirements based on player categories, only from a team.</li>
  <li><strong>Replacements</strong>:
    <ul>
      <li>Any player replacement due to injury will also mean replacement for the team that owns the player.</li>
      <li>If there is no injury replacement announced for a player or if a player is benched for more than 3 consecutive matches, the team can drop the player and pick any player from the same auction price pool and equal purse deduction - limited to 1 player in the season. This player can not be dropped in Phase 2 or 3.</li>
    </ul>
  </li>
  <li><strong>Captaincy</strong>:
    <ul>
      <li>Unlimited Cap/VC changes before IPL starts.</li>
      <li>Cap/VC change will be counted towards a change once the change is declared even if the player does not play the match (unless change is made with a disclaimer to be applicable only if the player plays).</li>
    </ul>
  </li>
  <li><strong>Match Completion</strong>:
    <ul>
      <li>Points for Incomplete Matches - If at least 1 inning of the match has been completed, its points will be counted but no bonus points will be allowed for this match. Not even cap/vc or Icon player bonus.</li>
      <li>If a match is washed out or not completed or abandoned on a points booster day, the team gets back their booster to be used on another day.</li>
    </ul>
  </li>
  <li><strong>Purse</strong>: Total Purse for each team - 150M.</li>
  <li><strong>Icon Player</strong>: 
    <ul>
      <li>Icon Player can not be cap/vc. Bonus for icon/cap/vc will be applicable over the final points they have earned in the match. However, cap/vc bonus will not apply on booster days.</li>
    </ul>
  </li>
</ul>

<hr />

<h3>Bidding Rules:</h3>
<h4>Phase 1 - Round 1 (Blind Bidding)</h4>
<ul>
  <li><strong>Marquee Bidding</strong>: One shot bids for 15 players out of 19 Marquee Players.</li>
  <li><strong>Icon Player Selection</strong>:
    <ul>
      <li>Each team to pick 1 ICON player from the 19 Marquee Player List. This player will remain Icon player for the team for the entire season and will always earn 2X points.</li>
      <li>Winner of Last season will get the first pick, then the 1st runner up, and so on for the icon player.</li>
      <li>20M will be soft-locked from the purse for each Icon player until the team buys there 15th player. After which the 1.25X amount of the highest player bought by the team at the time will be deducted from the purse.</li>
      <li>The final price of Icon Player (1.25X the highest bid player of the team after end of Phase 1 Bidding - both round 1 and 2), will be deducted at the end of the auction after the last player is bough by the team. This is to ensure some chaos and confusion about a team''s purse. Deal with it.</li>
      <li>If a team is going beyond 150M purse limit after the last player is sold and Icon Player''s final price is deducted, their last bought player have to be dropped and so on until they are within the purse limit.</li>
    </ul>
  </li>
  <li><strong>Process</strong>:
    <ul>
      <li>They''ll need to fill their bids and submit their sheet all at once when asked.</li>
      <li>The team with highest bid will win the player.</li>
      <li>The bid amount is the amount that the team will have to pay for the player.</li>
      <li>No team can refuse a player once it has won the bid for it; so bid wisely.</li>
      <li>The players won through blind bidding will have to conform to min/max player requirement for team category.</li>
    </ul>
  </li>
  <li><strong>Budget</strong>:
    <ul>
      <li>Min bid amount is 5 million; No upper limit (The team still needs to create a team of min 23 players).</li>
      <li>If a team wins bid for more than 7 players, they''ll have to drop the number of players over 7. The team with 2nd highest bid will be awarded the player.</li>
      <li>No team can buy more than 7 Marquee Players.</li>
      <li>Total combined bid for all 15 players cant be more than 100m.</li>
      <li>You can bid 0 if you do not wish to bid for a player.</li>
      <li>In case of tie, Winner of Last season will get the first pick, then the 1st runner up, and so on.</li>
    </ul>
  </li>
</ul>

<h4>Phase 1 - Round 2 (Open Bidding)</h4>
<ul>
  <li>Auction for all remaining players will be as our usual auction.</li>
  <li><strong>Increments</strong>:
    <ul>
      <li>Min increments of 0.5m for players in BP pool of 2 million.</li>
      <li>Min increments of 0.25m for players in BP pool of 1 million.</li>
      <li>Min increments of 0.1m for rest of the players.</li>
    </ul>
  </li>
  <li><strong>Penalty</strong>: If a team fails to buy min number of players, penalty of -1500 points PER player less than 23 will be awarded to the team. (Ex- If a team manages to buy only 20 players, they''ll be awarded -4500 points penalty).</li>
  <li><strong>Steal Token</strong>: One “steal” token per season: after a player is sold, another team can instantly “steal” that player by paying 10% more than the final bid; the original winner gets their purse back but cannot bid on that player again. Limit 1 steal per team per season.</li>
  <li><strong>Lightning Lots</strong>: 30‑second lightning lots: 4 Random players from each pool will be picked as lightning lots; they must be sold within 30 real‑time seconds of bidding starting. The highest bid at the end of 30 seconds will win the bid.</li>
  <li><strong>Privacy</strong>: Only the team can see their purse until Pool 1 bidding finishes. No other team will have access to other team''s balance purse until end of blind bids and Pool 1 bids complete.</li>
</ul>

<h4>Phase 2 Auction - Open bidding</h4>
<ul>
  <li>Phase 2 auction to happen after end of matches on April 11, 2025 (before April 12 matches begin).</li>
  <li>Maximum of 5 players can be released before the cutoff time.</li>
  <li>The number of players released will be the maximum number of players that can be bought in the auction.</li>
  <li>Points for released players will be forfeited.</li>
  <li>Points for new players bought will be added from 1st game of IPL onwards.</li>
</ul>

<h4>Phase 3 Auction - Open bidding</h4>
<ul>
  <li>Phase 3 auction to happen after end of matches on May 2, 2026 (before May 3rd matches begin).</li>
  <li>Maximum of 3 players can be released before the cutoff time.</li>
  <li>The number of players released will be the maximum number of players that can be bought in the auction.</li>
  <li>Points for released players will be forfeited.</li>
  <li>Points for new players bought will be added from May 3rd game onwards only.</li>
</ul>')
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;
