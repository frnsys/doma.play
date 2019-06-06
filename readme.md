# doma.play

## Usage

- `npm start` to start the frontend and API server, hen go to `localhost:5000` for the city view.
- `python main.py` to run the simulation

## Designer

Visit `/design` to access the map designer.

Basic usage:

- Click to select a cell
- Shift+click to add to the selection
- Ctrl+shift & move mouse to paint selection
- Click `source` to get map data
    - You can paste in map data here to "load" an existing map

![](static/designer.gif)

## Architecture

- Simulation process (Python)
    - Runs simulation
    - Reads commands from Redis
    - Outputs simulation state to Redis
- API server (Python)
    - Reads simulation state from Redis
    - Writes commands to Redis
    - Provides API for querying simulation state and executing actions in the simulation
    - Continues running in absence of players (i.e. persistent)
- Visualization client (JS, desktop)
    - Visualizes the simulation at the macro level (i.e. the cityscape)
- Player client (JS, mobile)
    - Visualizes the state of a single player-tenant
    - Provides interactivity for controlling the player-tenant

# Tuning the model

You can run the simulation with:

    DEBUG=1 python main.py

Which will create a file called `history.json` upon quitting (`CTRL+C`) the simulation. You can then run `plot.py` to see plots for each of the collected stats.

---

# Simulation design

## Initialization

The city has a tenant population, who live in the city, and a set of landlords, who represent institutional property owners.

1. Generate the city, based on the specified design
2. Generate `n` tenants, with an income drawn from the specified distribution and a random work location drawn from commercial buildings
3. Tenants decide where to move in, based on desirability and affordability. Tenants are on one year leases starting on a random month.
4. Distribute properties randomly to tenants and landlords
    - If there are occupying tenants, a property has 1/3 chance of going to a landlord, 1/3 a chance of going to an occupying tenant, and 1/3 chance of going to a random tenant
    - If there are no occupying tenants, there's a 50/50 chance of it going to a landlord or a random tenant
5. Generate a tenant social network. Each tenant is friends with 2 to 16 other random tenants. This social network is used for a word-of-mouth model.

## Steps

Each step represents one month.

1. Each unit's owner collects rent (if occupied).
2. In random order, step through landlords. Each landlord:
    1. Estimates market rents for each neighborhood. The landlord looks at rents of occupied units they own as well as a random sample of occupied units in each neighborhood. The landlord saves the maximum values of these rents.
    2. These samples are also used to estimate a ratio of maintenance to rental income; the landlord adjusts their maintenance expenditures based on these samples (i.e. they estimate the minimum maintenance expenditure they can get away with).
    3. For each neighborhood, the landlord fits a line to the past 12 months of these maximum rent samples to estimate the rental trends for that neighborhood. This also lets them estimate the profit of purchasing that unit now (i.e. the different in its current rent vs its projected rent).
    4. Each of the landlord's units' conditions decay randomly, and then improve based on their maintenance expenditure.
    5. Lowers the rent of vacant units, multiplying the existing rent by 0.98 every two months.
    6. Increases the rent of occupied units with lease renewals. The rent is increased either by their estimate for the rent trends of that neighborhood, or by `config.rent_increase_rate`, whichever is higher.
    7. Decides what properties to make offers on. A random neighborhood is chosen, weighted by estimated profits for each neighborhood, and a random sample of 20 properties is chosen. An estimated value is calculated for that property, based on projected rent, and compared to the current value (based on current rent). If the estimated value is greater, an offer is made at the estimated value.
3. In random order, step through tenants. Each tenant:
    1. Decides if they should move. If the tenant is homeless, they always look for an affordable option. Otherwise, they only look if they are between leases, or if their current rent is no longer affordable. In either case, they consider a random sample of vacant units and look for a unit that balances affordability and desirability (if the tenant has a current unit, a moving penalty is incorporated).
4. If this month is the start of a new year, all units are appraised, using the mean of recent (past year) sale prices in that neighborhood. If there haven't been any sales, `config.base_appreciation` is used instead.
5. DOMA:
    1. Collects rent from its tenants
    2. Pays dividends from this rent to its members
    3. Makes offers on properties. DOMA prioritizes non-DOMA properties of their members and cheap properties with high rent-to-price ratios. DOMA makes offers on as many properties as it can afford.
6. All property owners check purchase offers. Tenants compare the offer to the last appraised value of the property, landlords compare to their own estimate of its value based on projected rent. They accept when the offer is greater than that value.
