-- Seed Initial 4 Players for IPL 2026 Auction POC

INSERT INTO players (player_name, team, country, price, type, capped_uncapped, acquisition, role, status)
VALUES 
('Virat Kohli', 'RCB', 'India', '2 Cr', 'Indian', 'Capped', 'Retained', 'Batter', 'Sold'),
('Jasprit Bumrah', 'MI', 'India', '2 Cr', 'Indian', 'Capped', 'Retained', 'Bowler', 'Sold'),
('Rishabh Pant', 'LSG', 'India', '2 Cr', 'Indian', 'Capped', 'Auction', 'Batter/WK', 'Sold'),
('Mitchell Starc', 'DC', 'Australia', '2 Cr', 'Overseas', 'Capped', 'Auction', 'Bowler', 'Available');

-- To promote YOURSELF to Admin, run this in the SQL Editor (Replace with your email):
-- UPDATE profiles SET role = 'Admin' WHERE full_name = 'Your Name';
-- Or use your ID from the Auth section:
-- UPDATE profiles SET role = 'Admin' WHERE id = 'YOUR-USER-ID';
