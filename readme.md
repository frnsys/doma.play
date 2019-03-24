# doma.play

## Architecture

- Server (Python)
    - Runs simulation
    - Provides API for querying simulation state and executing actions in the simulation
    - Continues running in absence of players (i.e. persistent)
- Visualization client (JS, desktop)
    - Visualizes the simulation at the macro level (i.e. the cityscape)
- Player client (JS, mobile)
    - Visualizes the state of a single player-tenant
    - Provides interactivity for controlling the player-tenant

## Simulation

### Initialization

- Initialize $r \times c$ grid of parcel-buildings
- Initialize $q$ neighborhoods
- For each building $b$, initialize $n_b$ units, for a total of $n$ units
    - Each unit has a random rent per square foot $r_u$
- Initialize $m$ tenants, where $m < n$
    - Each tenant has a random income $i_t$
- Assign each tenant $t$ to a vacant unit $u^* = \text{argmax}_{\{u | o_u == 0\}} P_t(u)$, where $o_u$ is the occupancy of unit $u$ and $P_t(u)$ is the preference for unit $u$ of tenant $t$. Note that $P_t(u) = 0$ if $r_u a_u > i_t$, where $a_u$ is the area of unit $u$.
- Initialize $k$ landlord-developers
- Assign ownership of each unit $u$ to either:
    - a random landlord-developer $d$
    - its tenant $t_u$
    - a random tenant $t \neq t_u$

### Monthly loop

For each month $m$:

- For each landlord-developer $d$
    - __Update rent estimates__: For each unit $u_d$ owned by $d$, update estimated market rent $r_u^* := E_d(u)$, where $E_d$ is the rent estimation function for landlord-developer $d$
    - __Update neighborhood trend estimates__: For each neighborhood $B$, where $B$ is a set of units, fit a linear model of mean rents for the past $j$ months ($\bar r_{B,i} = r_u \forall \{u \in B; i \in j\}$) and get estimated rent for month $m+h_d$, where $h_d$ is the time horizon (in months) for developer $d$, estimated investment value $v_B$ of neighborhood $B$ is $r_{B,m_h+d} - \bar r_{B,m}$
    - __Update vacant rents__: for each vacant unit $u_d$ owned by $d$, update rent $r_u := V_d(u, m_u)$, where $V_d$ is the vacant rent update function for developer $d$ and $m_u$ is how many months $u$ has been vacant for. $V_d(u, m_u)$ should go down as $m_u$ goes up.
    - __Update occupied rents__: For each unit that is starting a new lease-year, update its rent $r_u := r_u^*$
    - __Make purchase offers__: Take the neighborhood with the greatest estimated investment value and get the units with the lowest rents. Submit a purchase offer $p_u = r_u * h_d$.
    - __Response to purchase offers__: For each received purchase offer $q_{u,i}$, accept highest purchase offer $q_{u,i}$ if $v_B * h_d < q_{u,i}$
- For each tenant $t$
    - If at the end of a lease-year, compute $P_t(u)$ for each of a sample of $n$ vacant units, and compute the preference difference $P^*_{t, u} = P_t(u) - P_t(u_t) - p_t$ where $u_t$ is the tenant's current residence and $p_t$ is a moving penalty for tenant $t$. If any $P^*_{t, u} > 0$, choose the maximum to move into.
    - If the tenant has no unit, compute $P_t(u)$ for all vacant units, and if any $P_t(u) > 0$, choose the maximum to move into.

### Possible enhancements

- Add in maintenance costs, which affect the attractiveness of a unit. Landlords decide how much to invest into maintenance, by estimating return for each dollar spend on maintenance (some maybe learn a linear model of appeal of unit $u$, $l_u$, relationship to $r_u$).
- Add in migration (people moving to/from the city)
- Demolition/construction of new buildings
