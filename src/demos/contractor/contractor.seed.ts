import type {
  ActivityEvent,
  ContractorState,
  Crew,
  CrewMember,
  Customer,
  DemoUser,
  Estimate,
  FieldRecord,
  FollowUp,
  Invoice,
  Job,
  Lead,
  Payment,
  ServiceLocation,
} from './contractor.types';
import { SCHEMA_VERSION } from './contractor.storage';
import { dayOffset, timeOffset, toDateOnly } from './contractor.utils';

/**
 * Seed workspace for Northline Contracting — a fictional Denver-area
 * field-service contractor.
 *
 * Two rules govern this file:
 *
 * 1. Everything is relative to `today`. No absolute dates, so the workspace
 *    never looks abandoned: an invoice that is 12 days overdue stays 12 days
 *    overdue whenever the demo is opened. Offsets are fixed integers rather
 *    than random, which keeps screenshots and browser tests deterministic.
 *
 * 2. Every record connects. Accepted estimates have jobs, completed jobs have
 *    invoices, invoice balances match their payments. A visitor who follows any
 *    thread finds a coherent operation at the other end, not orphaned rows.
 *
 * All names, customers and addresses are fictional.
 */

const address = (line1: string, city: string, zip: string, line2?: string) => ({
  line1,
  line2,
  city,
  state: 'CO',
  zip,
});

// ------------------------------------------------------------------- staff

const users: DemoUser[] = [
  { id: 'usr-1', name: 'Dana Whitfield', title: 'Owner / General Manager', role: 'owner' },
  { id: 'usr-2', name: 'Marcus Reed', title: 'Sales Manager', role: 'sales' },
  { id: 'usr-3', name: 'Priya Raman', title: 'Operations Coordinator', role: 'operations' },
  { id: 'usr-4', name: 'Tom Alvarez', title: 'Field Supervisor', role: 'field' },
];

const crews: Crew[] = [
  {
    id: 'crw-1',
    name: 'Roofing Crew A',
    trade: 'Roofing',
    weeklyCapacityHours: 160,
    notes: 'Tear-off and re-roof. Certified for steep-slope work.',
  },
  {
    id: 'crw-2',
    name: 'HVAC Service',
    trade: 'HVAC',
    weeklyCapacityHours: 120,
    notes: 'Installs and seasonal service calls.',
  },
  {
    id: 'crw-3',
    name: 'Plumbing & Drain',
    trade: 'Plumbing',
    weeklyCapacityHours: 120,
    notes: 'Repipe, drain lines and water heater replacement.',
  },
  {
    id: 'crw-4',
    name: 'Remodel Crew',
    trade: 'Remodeling',
    weeklyCapacityHours: 160,
    notes: 'Interior build-out, framing and finish carpentry.',
  },
];

const crewMembers: CrewMember[] = [
  { id: 'cm-1', crewId: 'crw-1', name: 'Luis Ortega', role: 'Crew Lead', skills: ['Steep slope', 'Tear-off', 'Safety lead'] },
  { id: 'cm-2', crewId: 'crw-1', name: 'Derek Pace', role: 'Installer', skills: ['Shingle', 'Flashing'] },
  { id: 'cm-3', crewId: 'crw-1', name: 'Andre Silva', role: 'Installer', skills: ['Underlayment', 'Gutters'] },
  { id: 'cm-4', crewId: 'crw-1', name: 'Kyle Bennett', role: 'Helper', skills: ['Site cleanup', 'Material staging'] },

  { id: 'cm-5', crewId: 'crw-2', name: 'Rosa Nieves', role: 'Crew Lead', skills: ['Load calculation', 'Rooftop units'] },
  { id: 'cm-6', crewId: 'crw-2', name: 'Grant Mueller', role: 'Technician', skills: ['Refrigerant', 'Diagnostics'] },
  { id: 'cm-7', crewId: 'crw-2', name: 'Ibrahim Saleh', role: 'Technician', skills: ['Ductwork', 'Controls'] },

  { id: 'cm-8', crewId: 'crw-3', name: 'Wes Lombardi', role: 'Crew Lead', skills: ['Repipe', 'Backflow'] },
  { id: 'cm-9', crewId: 'crw-3', name: 'Marta Quintero', role: 'Technician', skills: ['Drain line', 'Camera inspection'] },
  { id: 'cm-10', crewId: 'crw-3', name: 'Owen Frazier', role: 'Helper', skills: ['Excavation support'] },

  { id: 'cm-11', crewId: 'crw-4', name: 'Nathan Boyd', role: 'Crew Lead', skills: ['Framing', 'Project sequencing'] },
  { id: 'cm-12', crewId: 'crw-4', name: 'Sofia Marchetti', role: 'Installer', skills: ['Finish carpentry', 'Cabinetry'] },
  { id: 'cm-13', crewId: 'crw-4', name: 'Errol Hayes', role: 'Technician', skills: ['Drywall', 'Tile'] },
];

// --------------------------------------------------------------- customers

function buildCustomers(today: Date): Customer[] {
  const since = (days: number) => dayOffset(today, -days);
  return [
    {
      id: 'cus-1',
      code: 'CUS-1001',
      name: 'Harborview Property Group',
      company: 'Harborview Property Group LLC',
      phone: '(303) 555-0147',
      email: 'facilities@harborviewpg.example',
      billingAddress: address('1820 Blake St', 'Denver', '80202', 'Suite 400'),
      notes: 'Manages three multifamily properties. Invoices route through facilities, net 30.',
      customerSince: since(760),
    },
    {
      id: 'cus-2',
      code: 'CUS-1002',
      name: 'Elaine Brooks',
      phone: '(303) 555-0188',
      email: 'elaine.brooks@example.com',
      billingAddress: address('4412 Coors Ridge Dr', 'Lakewood', '80228'),
      notes: 'Prefers text confirmation the morning of a visit.',
      customerSince: since(520),
    },
    {
      id: 'cus-3',
      code: 'CUS-1003',
      name: 'Sterling Ridge HOA',
      company: 'Sterling Ridge Homeowners Association',
      phone: '(720) 555-0122',
      email: 'board@sterlingridgehoa.example',
      billingAddress: address('9075 E Mississippi Ave', 'Aurora', '80247'),
      notes: 'Board approval required above $10,000. Meets the first Tuesday monthly.',
      customerSince: since(410),
    },
    {
      id: 'cus-4',
      code: 'CUS-1004',
      name: 'Marcus Delgado',
      phone: '(303) 555-0193',
      email: 'm.delgado@example.com',
      billingAddress: address('7731 S Windermere St', 'Littleton', '80120'),
      notes: 'Referred by Elaine Brooks.',
      customerSince: since(280),
    },
    {
      id: 'cus-5',
      code: 'CUS-1005',
      name: 'Cedar Park Apartments',
      company: 'Cedar Park Residential',
      phone: '(720) 555-0164',
      email: 'maintenance@cedarparkres.example',
      billingAddress: address('6400 W 64th Ave', 'Arvada', '80003'),
      notes: 'Two buildings. Work orders must be scheduled with on-site manager.',
      customerSince: since(640),
    },
    {
      id: 'cus-6',
      code: 'CUS-1006',
      name: 'Janet Whitmore',
      phone: '(303) 555-0119',
      email: 'jwhitmore@example.com',
      billingAddress: address('11250 Sheridan Blvd', 'Westminster', '80020'),
      notes: '',
      customerSince: since(190),
    },
    {
      id: 'cus-7',
      code: 'CUS-1007',
      name: 'Foothills Dental Group',
      company: 'Foothills Dental Group PC',
      phone: '(720) 555-0175',
      email: 'office@foothillsdental.example',
      billingAddress: address('6825 S Galena St', 'Centennial', '80112', 'Suite 210'),
      notes: 'After-hours work only. Practice operates 7am-5pm weekdays.',
      customerSince: since(330),
    },
    {
      id: 'cus-8',
      code: 'CUS-1008',
      name: 'Ray Okafor',
      phone: '(303) 555-0136',
      email: 'ray.okafor@example.com',
      billingAddress: address('1907 Washington Ave', 'Golden', '80401'),
      notes: '',
      customerSince: since(95),
    },
    {
      id: 'cus-9',
      code: 'CUS-1009',
      name: 'Summit Auto Service',
      company: 'Summit Auto Service Inc',
      phone: '(720) 555-0158',
      email: 'ops@summitautoservice.example',
      billingAddress: address('8801 Washington St', 'Thornton', '80229'),
      notes: 'Shop stays open during work. Bay access must stay clear.',
      customerSince: since(455),
    },
    {
      id: 'cus-10',
      code: 'CUS-1010',
      name: 'Priscilla Vance',
      phone: '(303) 555-0142',
      email: 'p.vance@example.com',
      billingAddress: address('3320 S Broadway', 'Englewood', '80113'),
      notes: '',
      customerSince: since(60),
    },
    {
      id: 'cus-11',
      code: 'CUS-1011',
      name: 'Northgate Retail Partners',
      company: 'Northgate Retail Partners LP',
      phone: '(720) 555-0109',
      email: 'pm@northgateretail.example',
      billingAddress: address('2200 Market St', 'Denver', '80205', 'Suite 120'),
      notes: 'Tenant improvement work. Coordinate with property manager before entry.',
      customerSince: since(870),
    },
    {
      id: 'cus-12',
      code: 'CUS-1012',
      name: 'Daniel Choi',
      phone: '(303) 555-0171',
      email: 'daniel.choi@example.com',
      billingAddress: address('1455 Midway Blvd', 'Broomfield', '80020'),
      notes: '',
      customerSince: since(35),
    },
  ];
}

const locations: ServiceLocation[] = [
  { id: 'loc-1', customerId: 'cus-1', label: 'Blake Street Lofts', address: address('1820 Blake St', 'Denver', '80202') },
  { id: 'loc-2', customerId: 'cus-1', label: 'Larimer Court', address: address('2701 Larimer St', 'Denver', '80205') },
  { id: 'loc-3', customerId: 'cus-1', label: 'Union Station Flats', address: address('1750 Wewatta St', 'Denver', '80202') },
  { id: 'loc-4', customerId: 'cus-2', label: 'Residence', address: address('4412 Coors Ridge Dr', 'Lakewood', '80228') },
  { id: 'loc-5', customerId: 'cus-3', label: 'Clubhouse & Pool', address: address('9075 E Mississippi Ave', 'Aurora', '80247') },
  { id: 'loc-6', customerId: 'cus-3', label: 'Building C', address: address('9110 E Mississippi Ave', 'Aurora', '80247') },
  { id: 'loc-7', customerId: 'cus-4', label: 'Residence', address: address('7731 S Windermere St', 'Littleton', '80120') },
  { id: 'loc-8', customerId: 'cus-5', label: 'Building 1', address: address('6400 W 64th Ave', 'Arvada', '80003') },
  { id: 'loc-9', customerId: 'cus-5', label: 'Building 2', address: address('6420 W 64th Ave', 'Arvada', '80003') },
  { id: 'loc-10', customerId: 'cus-6', label: 'Residence', address: address('11250 Sheridan Blvd', 'Westminster', '80020') },
  { id: 'loc-11', customerId: 'cus-7', label: 'Centennial Office', address: address('6825 S Galena St', 'Centennial', '80112', 'Suite 210') },
  { id: 'loc-12', customerId: 'cus-8', label: 'Residence', address: address('1907 Washington Ave', 'Golden', '80401') },
  { id: 'loc-13', customerId: 'cus-9', label: 'Service Shop', address: address('8801 Washington St', 'Thornton', '80229') },
  { id: 'loc-14', customerId: 'cus-10', label: 'Residence', address: address('3320 S Broadway', 'Englewood', '80113') },
  { id: 'loc-15', customerId: 'cus-11', label: 'Market Street Retail', address: address('2200 Market St', 'Denver', '80205') },
  { id: 'loc-16', customerId: 'cus-11', label: 'Brighton Plaza', address: address('3400 Brighton Blvd', 'Denver', '80216') },
  { id: 'loc-17', customerId: 'cus-12', label: 'Residence', address: address('1455 Midway Blvd', 'Broomfield', '80020') },
  { id: 'loc-18', customerId: 'cus-2', label: 'Rental Property', address: address('880 S Union Blvd', 'Lakewood', '80228') },
];

// -------------------------------------------------------------------- leads

function buildLeads(today: Date): Lead[] {
  const created = (days: number) => timeOffset(today, -days, 9, 15);
  const follow = (days: number) => dayOffset(today, days);

  return [
    {
      id: 'lead-1', code: 'LD-1001', name: 'Hail damage roof replacement', contactName: 'Elaine Brooks',
      phone: '(303) 555-0188', email: 'elaine.brooks@example.com', source: 'Referral',
      serviceAddress: address('4412 Coors Ridge Dr', 'Lakewood', '80228'), serviceType: 'Roofing',
      description: 'Spring hail left granule loss across the south slope. Insurance adjuster has already inspected.',
      estimatedValue: 1840000, stage: 'Won', assignedUserId: 'usr-2', createdAt: created(74), customerId: 'cus-2',
    },
    {
      id: 'lead-2', code: 'LD-1002', name: 'Rooftop unit replacement — Blake Street', contactName: 'Priya Nandi',
      phone: '(303) 555-0147', email: 'facilities@harborviewpg.example', source: 'Repeat Customer',
      serviceAddress: address('1820 Blake St', 'Denver', '80202'), serviceType: 'HVAC',
      description: 'Two rooftop units past service life. Tenants reporting inconsistent heating on floors 3 and 4.',
      estimatedValue: 3250000, stage: 'Won', assignedUserId: 'usr-2', createdAt: created(58), customerId: 'cus-1',
    },
    {
      id: 'lead-3', code: 'LD-1003', name: 'Clubhouse re-roof', contactName: 'Gerald Tran',
      phone: '(720) 555-0122', email: 'board@sterlingridgehoa.example', source: 'Website',
      serviceAddress: address('9075 E Mississippi Ave', 'Aurora', '80247'), serviceType: 'Roofing',
      description: 'HOA board requesting full replacement on the clubhouse and pool structure.',
      estimatedValue: 4100000, stage: 'Won', assignedUserId: 'usr-2', createdAt: created(52), customerId: 'cus-3',
    },
    {
      id: 'lead-4', code: 'LD-1004', name: 'Building 2 water heater replacement', contactName: 'Nora Kessler',
      phone: '(720) 555-0164', email: 'maintenance@cedarparkres.example', source: 'Repeat Customer',
      serviceAddress: address('6420 W 64th Ave', 'Arvada', '80003'), serviceType: 'Plumbing',
      description: 'Two commercial water heaters failing intermittently. Needs replacement before winter.',
      estimatedValue: 1620000, stage: 'Won', assignedUserId: 'usr-2', createdAt: created(46), customerId: 'cus-5',
    },
    {
      id: 'lead-5', code: 'LD-1005', name: 'Operatory HVAC rebalance', contactName: 'Dr. Alan Reyes',
      phone: '(720) 555-0175', email: 'office@foothillsdental.example', source: 'Google Search',
      serviceAddress: address('6825 S Galena St', 'Centennial', '80112', 'Suite 210'), serviceType: 'HVAC',
      description: 'Uneven temperatures between operatories. After-hours work required.',
      estimatedValue: 860000, stage: 'Won', assignedUserId: 'usr-2', createdAt: created(40), customerId: 'cus-7',
    },
    {
      id: 'lead-6', code: 'LD-1006', name: 'Kitchen remodel — Windermere', contactName: 'Marcus Delgado',
      phone: '(303) 555-0193', email: 'm.delgado@example.com', source: 'Referral',
      serviceAddress: address('7731 S Windermere St', 'Littleton', '80120'), serviceType: 'Remodeling',
      description: 'Full kitchen remodel: cabinets, counters, flooring and electrical updates.',
      estimatedValue: 5400000, stage: 'Won', assignedUserId: 'usr-2', createdAt: created(36), customerId: 'cus-4',
    },
    {
      id: 'lead-7', code: 'LD-1007', name: 'Shop drain line backup', contactName: 'Curtis Hale',
      phone: '(720) 555-0158', email: 'ops@summitautoservice.example', source: 'Phone Inquiry',
      serviceAddress: address('8801 Washington St', 'Thornton', '80229'), serviceType: 'Plumbing',
      description: 'Recurring backup in the wash bay drain. Camera inspection requested.',
      estimatedValue: 740000, stage: 'Won', assignedUserId: 'usr-2', createdAt: created(30), customerId: 'cus-9',
    },
    {
      id: 'lead-8', code: 'LD-1008', name: 'Suite 120 tenant build-out', contactName: 'Alicia Burnham',
      phone: '(720) 555-0109', email: 'pm@northgateretail.example', source: 'Repeat Customer',
      serviceAddress: address('2200 Market St', 'Denver', '80205'), serviceType: 'Remodeling',
      description: 'Interior build-out for incoming retail tenant. Framing, drywall, finishes.',
      estimatedValue: 7850000, stage: 'Estimate Sent', assignedUserId: 'usr-2', createdAt: created(24),
      nextFollowUpAt: follow(2), customerId: 'cus-11',
    },
    {
      id: 'lead-9', code: 'LD-1009', name: 'Panel upgrade and EV circuit', contactName: 'Ray Okafor',
      phone: '(303) 555-0136', email: 'ray.okafor@example.com', source: 'Website',
      serviceAddress: address('1907 Washington Ave', 'Golden', '80401'), serviceType: 'Electrical',
      description: '200 amp panel upgrade plus a dedicated circuit for a garage EV charger.',
      estimatedValue: 980000, stage: 'Estimate Sent', assignedUserId: 'usr-2', createdAt: created(19),
      nextFollowUpAt: follow(1), customerId: 'cus-8',
    },
    {
      id: 'lead-10', code: 'LD-1010', name: 'Gutter replacement — Building C', contactName: 'Gerald Tran',
      phone: '(720) 555-0122', email: 'board@sterlingridgehoa.example', source: 'Repeat Customer',
      serviceAddress: address('9110 E Mississippi Ave', 'Aurora', '80247'), serviceType: 'Roofing',
      description: 'Gutters and downspouts pulling away on the north elevation.',
      estimatedValue: 1150000, stage: 'Estimate Sent', assignedUserId: 'usr-2', createdAt: created(15),
      nextFollowUpAt: follow(4), customerId: 'cus-3',
    },
    {
      id: 'lead-11', code: 'LD-1011', name: 'Bathroom remodel', contactName: 'Priscilla Vance',
      phone: '(303) 555-0142', email: 'p.vance@example.com', source: 'Social Media',
      serviceAddress: address('3320 S Broadway', 'Englewood', '80113'), serviceType: 'Remodeling',
      description: 'Primary bathroom: tile shower, vanity replacement, new exhaust fan.',
      estimatedValue: 2250000, stage: 'Estimate Needed', assignedUserId: 'usr-2', createdAt: created(11),
      nextFollowUpAt: follow(1), customerId: 'cus-10',
    },
    {
      id: 'lead-12', code: 'LD-1012', name: 'Furnace replacement', contactName: 'Janet Whitmore',
      phone: '(303) 555-0119', email: 'jwhitmore@example.com', source: 'Yard Sign',
      serviceAddress: address('11250 Sheridan Blvd', 'Westminster', '80020'), serviceType: 'HVAC',
      description: 'Original furnace, 22 years old. Wants a quote before the heating season.',
      estimatedValue: 1280000, stage: 'Estimate Needed', assignedUserId: 'usr-2', createdAt: created(9),
      nextFollowUpAt: follow(0), customerId: 'cus-6',
    },
    {
      id: 'lead-13', code: 'LD-1013', name: 'Deck rebuild', contactName: 'Daniel Choi',
      phone: '(303) 555-0171', email: 'daniel.choi@example.com', source: 'Referral',
      serviceAddress: address('1455 Midway Blvd', 'Broomfield', '80020'), serviceType: 'Remodeling',
      description: 'Rear deck showing rot at the ledger. Wants composite decking.',
      estimatedValue: 1950000, stage: 'Qualified', assignedUserId: 'usr-2', createdAt: created(7),
      nextFollowUpAt: follow(2), customerId: 'cus-12',
    },
    {
      id: 'lead-14', code: 'LD-1014', name: 'Sprinkler system repair', contactName: 'Holly Bannister',
      phone: '(303) 555-0155', email: 'h.bannister@example.com', source: 'Home Show',
      serviceAddress: address('5540 S Nevada St', 'Littleton', '80120'), serviceType: 'Landscaping',
      description: 'Two zones not firing. Possible valve or wiring fault.',
      estimatedValue: 320000, stage: 'Qualified', assignedUserId: 'usr-2', createdAt: created(5),
      nextFollowUpAt: follow(3),
    },
    {
      id: 'lead-15', code: 'LD-1015', name: 'Warehouse lighting retrofit', contactName: 'Victor Amaya',
      phone: '(720) 555-0198', email: 'v.amaya@example.com', source: 'Google Search',
      serviceAddress: address('4700 Havana St', 'Denver', '80239'), serviceType: 'Electrical',
      description: 'LED retrofit across roughly 12,000 sq ft of warehouse space.',
      estimatedValue: 4200000, stage: 'Contacted', assignedUserId: 'usr-2', createdAt: created(4),
      nextFollowUpAt: follow(1),
    },
    {
      id: 'lead-16', code: 'LD-1016', name: 'Skylight leak', contactName: 'Renee Ashford',
      phone: '(303) 555-0167', email: 'r.ashford@example.com', source: 'Website',
      serviceAddress: address('2215 Dexter St', 'Denver', '80207'), serviceType: 'Roofing',
      description: 'Water staining on the ceiling below a skylight after recent storms.',
      estimatedValue: 480000, stage: 'New', assignedUserId: 'usr-2', createdAt: created(2),
      nextFollowUpAt: follow(0),
    },
    {
      id: 'lead-17', code: 'LD-1017', name: 'Basement egress window', contactName: 'Paul Sandoval',
      phone: '(720) 555-0131', email: 'p.sandoval@example.com', source: 'Referral',
      serviceAddress: address('9820 W 26th Ave', 'Lakewood', '80215'), serviceType: 'General Contracting',
      description: 'Adding a code-compliant egress window to a finished basement bedroom.',
      estimatedValue: 890000, stage: 'New', assignedUserId: 'usr-2', createdAt: created(1),
      nextFollowUpAt: follow(1),
    },
  ];
}

// ---------------------------------------------------------------- estimates

const DEFAULT_TERMS =
  'Estimate valid for 30 days from the issue date. Work scheduled upon written acceptance. ' +
  'Balance due within 30 days of completion. Change orders quoted separately before work proceeds.';

function buildEstimates(today: Date): Estimate[] {
  const day = (offset: number) => dayOffset(today, offset);
  const stamp = (offset: number) => timeOffset(today, offset, 11, 0);

  return [
    {
      id: 'est-1', code: 'EST-2001', customerId: 'cus-2', locationId: 'loc-4', leadId: 'lead-1',
      title: 'Hail damage roof replacement', status: 'Accepted',
      scope: 'Full tear-off and replacement of the existing asphalt shingle roof, including underlayment, ice and water shield at eaves and valleys, new pipe boots, ridge vent and cleanup.',
      items: [
        { id: 'li-1', kind: 'Labor', description: 'Tear-off and disposal of existing shingles', quantity: 28, unit: 'sq ft', unitPrice: 12500 },
        { id: 'li-2', kind: 'Materials', description: 'Architectural asphalt shingles, 30-year', quantity: 28, unit: 'sq ft', unitPrice: 18500 },
        { id: 'li-3', kind: 'Materials', description: 'Synthetic underlayment and ice barrier', quantity: 1, unit: 'lot', unitPrice: 142000 },
        { id: 'li-4', kind: 'Labor', description: 'Installation labor', quantity: 64, unit: 'hour', unitPrice: 8500 },
        { id: 'li-5', kind: 'Disposal', description: 'Dumpster and haul-off', quantity: 1, unit: 'each', unitPrice: 68000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-70), expiresAt: day(-40),
      notes: 'Insurance claim number on file with the adjuster.', terms: DEFAULT_TERMS, createdAt: stamp(-70),
    },
    {
      id: 'est-2', code: 'EST-2002', customerId: 'cus-1', locationId: 'loc-1', leadId: 'lead-2',
      title: 'Rooftop unit replacement — floors 3 and 4', status: 'Accepted',
      scope: 'Remove and dispose of two failing rooftop package units. Furnish and install two 7.5-ton replacement units, including curb adapters, electrical disconnects, controls integration and start-up.',
      items: [
        { id: 'li-6', kind: 'Equipment', description: '7.5-ton rooftop package unit', quantity: 2, unit: 'each', unitPrice: 985000 },
        { id: 'li-7', kind: 'Materials', description: 'Curb adapters and flashing', quantity: 2, unit: 'each', unitPrice: 128000 },
        { id: 'li-8', kind: 'Labor', description: 'Crane set and installation', quantity: 48, unit: 'hour', unitPrice: 11500 },
        { id: 'li-9', kind: 'Labor', description: 'Controls integration and commissioning', quantity: 12, unit: 'hour', unitPrice: 12500 },
        { id: 'li-10', kind: 'Permit', description: 'Mechanical permit', quantity: 1, unit: 'each', unitPrice: 45000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-54), expiresAt: day(-24),
      notes: 'Crane access approved through the alley on the north side.', terms: DEFAULT_TERMS, createdAt: stamp(-54),
    },
    {
      id: 'est-3', code: 'EST-2003', customerId: 'cus-3', locationId: 'loc-5', leadId: 'lead-3',
      title: 'Clubhouse and pool structure re-roof', status: 'Accepted',
      scope: 'Complete tear-off and re-roof of the clubhouse and adjoining pool structure. Includes deck inspection, replacement of damaged sheathing at cost, new underlayment and 40-year shingles.',
      items: [
        { id: 'li-11', kind: 'Labor', description: 'Tear-off, both structures', quantity: 46, unit: 'sq ft', unitPrice: 13500 },
        { id: 'li-12', kind: 'Materials', description: 'Architectural shingles, 40-year', quantity: 46, unit: 'sq ft', unitPrice: 21500 },
        { id: 'li-13', kind: 'Materials', description: 'Sheathing replacement allowance', quantity: 1, unit: 'lot', unitPrice: 185000 },
        { id: 'li-14', kind: 'Labor', description: 'Installation labor', quantity: 96, unit: 'hour', unitPrice: 8500 },
        { id: 'li-15', kind: 'Disposal', description: 'Dumpster, two pulls', quantity: 2, unit: 'each', unitPrice: 68000 },
        { id: 'li-16', kind: 'Permit', description: 'Roofing permit', quantity: 1, unit: 'each', unitPrice: 38000 },
      ],
      taxRate: 8.81, discount: 150000, issuedAt: day(-48), expiresAt: day(-18),
      notes: 'Board approved at the monthly meeting. Discount applied for combined scope.',
      terms: DEFAULT_TERMS, createdAt: stamp(-48),
    },
    {
      id: 'est-4', code: 'EST-2004', customerId: 'cus-5', locationId: 'loc-9', leadId: 'lead-4',
      title: 'Commercial water heater replacement', status: 'Accepted',
      scope: 'Remove two failing commercial water heaters. Furnish and install two 100-gallon replacements with expansion tanks, new shutoffs and updated venting.',
      items: [
        { id: 'li-17', kind: 'Equipment', description: '100-gallon commercial water heater', quantity: 2, unit: 'each', unitPrice: 428000 },
        { id: 'li-18', kind: 'Materials', description: 'Expansion tanks, valves and venting', quantity: 1, unit: 'lot', unitPrice: 165000 },
        { id: 'li-19', kind: 'Labor', description: 'Removal and installation', quantity: 26, unit: 'hour', unitPrice: 10500 },
        { id: 'li-20', kind: 'Permit', description: 'Plumbing permit', quantity: 1, unit: 'each', unitPrice: 32000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-42), expiresAt: day(-12),
      notes: '', terms: DEFAULT_TERMS, createdAt: stamp(-42),
    },
    {
      id: 'est-5', code: 'EST-2005', customerId: 'cus-7', locationId: 'loc-11', leadId: 'lead-5',
      title: 'Operatory HVAC rebalance', status: 'Accepted',
      scope: 'Diagnose and correct airflow imbalance across six operatories. Includes duct modifications, damper installation, and post-work balance report.',
      items: [
        { id: 'li-21', kind: 'Labor', description: 'Diagnostic and airflow testing', quantity: 8, unit: 'hour', unitPrice: 12500 },
        { id: 'li-22', kind: 'Materials', description: 'Balancing dampers and duct materials', quantity: 1, unit: 'lot', unitPrice: 138000 },
        { id: 'li-23', kind: 'Labor', description: 'Duct modification, after hours', quantity: 24, unit: 'hour', unitPrice: 14500 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-38), expiresAt: day(-8),
      notes: 'All work performed after 5pm per practice request.', terms: DEFAULT_TERMS, createdAt: stamp(-38),
    },
    {
      id: 'est-6', code: 'EST-2006', customerId: 'cus-4', locationId: 'loc-7', leadId: 'lead-6',
      title: 'Kitchen remodel', status: 'Accepted',
      scope: 'Full kitchen remodel: demolition, cabinet installation, quartz countertops, tile backsplash, LVP flooring, updated electrical for island and under-cabinet lighting.',
      items: [
        { id: 'li-24', kind: 'Labor', description: 'Demolition and disposal', quantity: 16, unit: 'hour', unitPrice: 7500 },
        { id: 'li-25', kind: 'Materials', description: 'Cabinetry package', quantity: 1, unit: 'lot', unitPrice: 1480000 },
        { id: 'li-26', kind: 'Materials', description: 'Quartz countertops, fabricated and installed', quantity: 52, unit: 'sq ft', unitPrice: 8900 },
        { id: 'li-27', kind: 'Materials', description: 'Tile backsplash and LVP flooring', quantity: 1, unit: 'lot', unitPrice: 385000 },
        { id: 'li-28', kind: 'Labor', description: 'Install labor', quantity: 120, unit: 'hour', unitPrice: 9500 },
        { id: 'li-29', kind: 'Labor', description: 'Electrical rough-in and finish', quantity: 20, unit: 'hour', unitPrice: 11500 },
        { id: 'li-30', kind: 'Permit', description: 'Building and electrical permits', quantity: 1, unit: 'each', unitPrice: 62000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-34), expiresAt: day(-4),
      notes: 'Homeowner selected finishes at the showroom.', terms: DEFAULT_TERMS, createdAt: stamp(-34),
    },
    {
      id: 'est-7', code: 'EST-2007', customerId: 'cus-9', locationId: 'loc-13', leadId: 'lead-7',
      title: 'Wash bay drain line repair', status: 'Accepted',
      scope: 'Camera inspection of the wash bay drain line, hydro-jetting, and replacement of the collapsed section under the slab.',
      items: [
        { id: 'li-31', kind: 'Labor', description: 'Camera inspection and locate', quantity: 4, unit: 'hour', unitPrice: 11500 },
        { id: 'li-32', kind: 'Labor', description: 'Concrete cut, excavation and repair', quantity: 22, unit: 'hour', unitPrice: 10500 },
        { id: 'li-33', kind: 'Materials', description: 'Pipe, fittings and concrete patch', quantity: 1, unit: 'lot', unitPrice: 128000 },
        { id: 'li-34', kind: 'Equipment', description: 'Hydro-jetting equipment', quantity: 1, unit: 'day', unitPrice: 78000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-28), expiresAt: day(2),
      notes: '', terms: DEFAULT_TERMS, createdAt: stamp(-28),
    },
    {
      id: 'est-8', code: 'EST-2008', customerId: 'cus-11', locationId: 'loc-15', leadId: 'lead-8',
      title: 'Suite 120 tenant build-out', status: 'Sent',
      scope: 'Interior build-out for incoming retail tenant: partition framing, drywall, ceiling grid, paint, flooring and final electrical trim per tenant plans.',
      items: [
        { id: 'li-35', kind: 'Labor', description: 'Partition framing', quantity: 88, unit: 'hour', unitPrice: 9500 },
        { id: 'li-36', kind: 'Materials', description: 'Framing, drywall and ceiling materials', quantity: 1, unit: 'lot', unitPrice: 1650000 },
        { id: 'li-37', kind: 'Labor', description: 'Drywall, tape and finish', quantity: 72, unit: 'hour', unitPrice: 9500 },
        { id: 'li-38', kind: 'Materials', description: 'Flooring and paint', quantity: 1, unit: 'lot', unitPrice: 720000 },
        { id: 'li-39', kind: 'Labor', description: 'Electrical trim-out', quantity: 32, unit: 'hour', unitPrice: 11500 },
        { id: 'li-40', kind: 'Permit', description: 'Tenant improvement permit', quantity: 1, unit: 'each', unitPrice: 145000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-16), expiresAt: day(14),
      notes: 'Property manager reviewing with the tenant.', terms: DEFAULT_TERMS, createdAt: stamp(-16),
    },
    {
      id: 'est-9', code: 'EST-2009', customerId: 'cus-8', locationId: 'loc-12', leadId: 'lead-9',
      title: 'Panel upgrade and EV circuit', status: 'Viewed',
      scope: 'Replace the existing 100 amp panel with a 200 amp service. Install a dedicated 50 amp circuit and receptacle for a garage EV charger. Includes utility coordination and inspection.',
      items: [
        { id: 'li-41', kind: 'Equipment', description: '200 amp panel and breakers', quantity: 1, unit: 'each', unitPrice: 268000 },
        { id: 'li-42', kind: 'Labor', description: 'Service upgrade labor', quantity: 16, unit: 'hour', unitPrice: 11500 },
        { id: 'li-43', kind: 'Labor', description: 'EV circuit installation', quantity: 6, unit: 'hour', unitPrice: 11500 },
        { id: 'li-44', kind: 'Materials', description: 'Conduit, wire and receptacle', quantity: 1, unit: 'lot', unitPrice: 96000 },
        { id: 'li-45', kind: 'Permit', description: 'Electrical permit and inspection', quantity: 1, unit: 'each', unitPrice: 28000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-11), expiresAt: day(19),
      notes: 'Customer opened the estimate twice. Follow up scheduled.', terms: DEFAULT_TERMS, createdAt: stamp(-11),
    },
    {
      id: 'est-10', code: 'EST-2010', customerId: 'cus-3', locationId: 'loc-6', leadId: 'lead-10',
      title: 'Building C gutter replacement', status: 'Sent',
      scope: 'Remove and replace gutters and downspouts on the north and east elevations. Includes new hangers, sealed miters and downspout extensions.',
      items: [
        { id: 'li-46', kind: 'Labor', description: 'Removal and disposal of existing gutters', quantity: 10, unit: 'hour', unitPrice: 8500 },
        { id: 'li-47', kind: 'Materials', description: '6-inch seamless gutter and downspouts', quantity: 320, unit: 'linear ft', unitPrice: 1450 },
        { id: 'li-48', kind: 'Labor', description: 'Installation labor', quantity: 26, unit: 'hour', unitPrice: 8500 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-9), expiresAt: day(21),
      notes: '', terms: DEFAULT_TERMS, createdAt: stamp(-9),
    },
    {
      id: 'est-11', code: 'EST-2011', customerId: 'cus-1', locationId: 'loc-2', title: 'Larimer Court gutter and downspout repair',
      status: 'Declined',
      scope: 'Repair separated gutter sections and replace three downspouts at the Larimer Court property.',
      items: [
        { id: 'li-49', kind: 'Labor', description: 'Gutter repair labor', quantity: 12, unit: 'hour', unitPrice: 8500 },
        { id: 'li-50', kind: 'Materials', description: 'Downspouts and hangers', quantity: 1, unit: 'lot', unitPrice: 78000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-26), expiresAt: day(4),
      notes: 'Owner deferred to next fiscal year.', terms: DEFAULT_TERMS, createdAt: stamp(-26),
    },
    {
      id: 'est-12', code: 'EST-2012', customerId: 'cus-6', locationId: 'loc-10', leadId: 'lead-12',
      title: 'Furnace replacement', status: 'Draft',
      scope: 'Replace the existing 22-year-old furnace with a high-efficiency condensing unit. Includes venting modifications, new thermostat and start-up.',
      items: [
        { id: 'li-51', kind: 'Equipment', description: '96% AFUE condensing furnace', quantity: 1, unit: 'each', unitPrice: 685000 },
        { id: 'li-52', kind: 'Labor', description: 'Removal and installation', quantity: 14, unit: 'hour', unitPrice: 11500 },
        { id: 'li-53', kind: 'Materials', description: 'Venting, thermostat and misc.', quantity: 1, unit: 'lot', unitPrice: 124000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: dayOffset(today, 0), expiresAt: day(30),
      notes: 'Pending final equipment selection.', terms: DEFAULT_TERMS, createdAt: stamp(-1),
    },
    {
      id: 'est-13', code: 'EST-2013', customerId: 'cus-10', locationId: 'loc-14', leadId: 'lead-11',
      title: 'Primary bathroom remodel', status: 'Expired',
      scope: 'Tile shower replacement, new vanity and fixtures, exhaust fan upgrade and flooring.',
      items: [
        { id: 'li-54', kind: 'Labor', description: 'Demolition', quantity: 10, unit: 'hour', unitPrice: 7500 },
        { id: 'li-55', kind: 'Materials', description: 'Tile, vanity and fixtures', quantity: 1, unit: 'lot', unitPrice: 985000 },
        { id: 'li-56', kind: 'Labor', description: 'Install labor', quantity: 56, unit: 'hour', unitPrice: 9500 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-64), expiresAt: day(-34),
      notes: 'Customer paused the project. Worth re-quoting.', terms: DEFAULT_TERMS, createdAt: stamp(-64),
    },
  ];
}

// --------------------------------------------------------------------- jobs

function buildJobs(today: Date): Job[] {
  const at = (days: number, hour: number) => timeOffset(today, days, hour);

  return [
    {
      id: 'job-1', code: 'JOB-3001', customerId: 'cus-2', locationId: 'loc-4', estimateId: 'est-1',
      title: 'Hail damage roof replacement', status: 'Completed',
      scope: 'Full tear-off and replacement of the existing asphalt shingle roof.',
      scheduledStart: at(-62, 7), scheduledEnd: at(-60, 16), crewId: 'crw-1', priority: 'High',
      notes: 'Insurance claim. Adjuster photos required before tear-off.',
      completedAt: at(-60, 15), completionNotes: 'Roof complete, final walkthrough with homeowner. Site cleaned and magnet-swept.',
      createdAt: at(-68, 9),
    },
    {
      id: 'job-2', code: 'JOB-3002', customerId: 'cus-1', locationId: 'loc-1', estimateId: 'est-2',
      title: 'Rooftop unit replacement — floors 3 and 4', status: 'In Progress',
      scope: 'Remove two failing rooftop package units and install two 7.5-ton replacements.',
      scheduledStart: at(-2, 6), scheduledEnd: at(1, 17), crewId: 'crw-2', priority: 'High',
      notes: 'Crane scheduled for the first morning. Alley closure permit on file.',
      createdAt: at(-50, 10),
    },
    {
      id: 'job-3', code: 'JOB-3003', customerId: 'cus-3', locationId: 'loc-5', estimateId: 'est-3',
      title: 'Clubhouse and pool structure re-roof', status: 'Scheduled',
      scope: 'Complete tear-off and re-roof of the clubhouse and adjoining pool structure.',
      scheduledStart: at(3, 7), scheduledEnd: at(7, 16), crewId: 'crw-1', priority: 'Normal',
      notes: 'Pool area must stay closed to residents during tear-off.',
      createdAt: at(-44, 9),
    },
    {
      id: 'job-4', code: 'JOB-3004', customerId: 'cus-5', locationId: 'loc-9', estimateId: 'est-4',
      title: 'Commercial water heater replacement', status: 'Completed',
      scope: 'Remove two failing commercial water heaters and install two 100-gallon replacements.',
      scheduledStart: at(-30, 7), scheduledEnd: at(-29, 15), crewId: 'crw-3', priority: 'High',
      notes: 'Coordinate shutoff window with the on-site manager.',
      completedAt: at(-29, 14), completionNotes: 'Both units installed and tested. Old units hauled off.',
      createdAt: at(-40, 11),
    },
    {
      id: 'job-5', code: 'JOB-3005', customerId: 'cus-7', locationId: 'loc-11', estimateId: 'est-5',
      title: 'Operatory HVAC rebalance', status: 'Completed',
      scope: 'Correct airflow imbalance across six operatories, including duct modifications and dampers.',
      scheduledStart: at(-24, 17), scheduledEnd: at(-22, 22), crewId: 'crw-2', priority: 'Normal',
      notes: 'After-hours only. Alarm code provided by office manager.',
      completedAt: at(-22, 21), completionNotes: 'Balance report delivered. All operatories within 2 degrees.',
      createdAt: at(-36, 14),
    },
    {
      id: 'job-6', code: 'JOB-3006', customerId: 'cus-4', locationId: 'loc-7', estimateId: 'est-6',
      title: 'Kitchen remodel', status: 'In Progress',
      scope: 'Full kitchen remodel: demolition, cabinets, countertops, backsplash, flooring and electrical.',
      scheduledStart: at(-9, 7), scheduledEnd: at(6, 16), crewId: 'crw-4', priority: 'Normal',
      notes: 'Countertop template scheduled once base cabinets are set.',
      createdAt: at(-32, 10),
    },
    {
      id: 'job-7', code: 'JOB-3007', customerId: 'cus-9', locationId: 'loc-13', estimateId: 'est-7',
      title: 'Wash bay drain line repair', status: 'Completed',
      scope: 'Camera inspection, hydro-jetting and replacement of the collapsed drain section under the slab.',
      scheduledStart: at(-14, 7), scheduledEnd: at(-13, 16), crewId: 'crw-3', priority: 'Urgent',
      notes: 'Shop remained open. Bay 3 closed during excavation.',
      completedAt: at(-13, 15), completionNotes: 'Collapsed section replaced, slab patched, line flows clear on re-inspection.',
      createdAt: at(-26, 8),
    },
    {
      id: 'job-8', code: 'JOB-3008', customerId: 'cus-1', locationId: 'loc-3', title: 'Union Station Flats — common area repairs',
      status: 'Scheduled',
      scope: 'Repair damaged drywall and ceiling tile in the second-floor common corridor following a pipe leak.',
      scheduledStart: at(1, 8), scheduledEnd: at(2, 15), crewId: 'crw-4', priority: 'Normal',
      notes: 'Access badge required from building management.',
      createdAt: at(-6, 13),
    },
    {
      id: 'job-9', code: 'JOB-3009', customerId: 'cus-5', locationId: 'loc-8', title: 'Building 1 seasonal HVAC service',
      status: 'On Hold',
      scope: 'Seasonal service across all rooftop units on Building 1.',
      scheduledStart: at(-4, 8), scheduledEnd: at(-4, 16), crewId: 'crw-2', priority: 'Low',
      notes: 'On hold — property manager requested a delay until after the tenant inspection.',
      createdAt: at(-12, 9),
    },
    {
      id: 'job-10', code: 'JOB-3010', customerId: 'cus-12', locationId: 'loc-17', title: 'Deck rebuild — site assessment',
      status: 'Unscheduled',
      scope: 'Assess ledger rot and confirm scope before the composite deck rebuild is quoted.',
      crewId: undefined, priority: 'Normal',
      notes: 'Waiting on the homeowner to confirm availability.',
      createdAt: at(-3, 15),
    },
  ];
}

// ----------------------------------------------------------- field records

function buildFieldRecords(today: Date): FieldRecord[] {
  const at = (days: number, hour: number) => timeOffset(today, days, hour);
  const check = (labels: string[], doneCount: number) =>
    labels.map((label, i) => ({ label, done: i < doneCount }));

  return [
    {
      id: 'fr-1', code: 'FR-6001', jobId: 'job-1', crewId: 'crw-1', memberId: 'cm-1', occurredAt: at(-62, 16),
      workPerformed: 'Tear-off of existing shingles on the south and west slopes. Deck inspected, two sheets of sheathing replaced.',
      statusUpdate: 'Tear-off complete, dry-in installed before end of day.',
      notes: 'Adjuster photos taken before tear-off began.', hours: 9, materialsUsed: '2 sheets OSB, synthetic underlayment',
      checklist: check(['Site protection installed', 'Adjuster photos taken', 'Tear-off complete', 'Dry-in installed'], 4),
    },
    {
      id: 'fr-2', code: 'FR-6002', jobId: 'job-1', crewId: 'crw-1', memberId: 'cm-2', occurredAt: at(-61, 16),
      workPerformed: 'Installed ice and water shield at eaves and valleys. Started shingle installation on the south slope.',
      statusUpdate: 'Approximately 60 percent of shingles installed.',
      notes: '', hours: 9.5, materialsUsed: 'Ice barrier, 14 squares of shingles',
      checklist: check(['Ice barrier installed', 'Valleys flashed', 'Shingle field started'], 3),
    },
    {
      id: 'fr-3', code: 'FR-6003', jobId: 'job-1', crewId: 'crw-1', memberId: 'cm-1', occurredAt: at(-60, 15),
      workPerformed: 'Completed shingle installation, ridge vent, pipe boots and final cleanup.',
      statusUpdate: 'Job complete. Walkthrough with homeowner signed off.',
      notes: 'Magnet sweep performed twice across the driveway and lawn.', hours: 8, materialsUsed: 'Ridge vent, pipe boots, ridge cap',
      checklist: check(['Shingles complete', 'Ridge vent installed', 'Cleanup and magnet sweep', 'Customer walkthrough'], 4),
    },
    {
      id: 'fr-4', code: 'FR-6004', jobId: 'job-2', crewId: 'crw-2', memberId: 'cm-5', occurredAt: at(-2, 15),
      workPerformed: 'Crane set completed. Both old rooftop units removed and staged for disposal. New curb adapters installed.',
      statusUpdate: 'Units removed, curb adapters set. Ready to land new equipment.',
      notes: 'Alley closure went as permitted, no tenant disruption.', hours: 10, materialsUsed: '2 curb adapters, flashing',
      checklist: check(['Alley closure in place', 'Old units removed', 'Curb adapters installed', 'New units landed'], 3),
    },
    {
      id: 'fr-5', code: 'FR-6005', jobId: 'job-2', crewId: 'crw-2', memberId: 'cm-6', occurredAt: at(-1, 16),
      workPerformed: 'Set both replacement units, completed electrical disconnects and started refrigerant line connections.',
      statusUpdate: 'Units set and powered. Controls integration remaining.',
      notes: '', hours: 9, materialsUsed: 'Disconnects, line set materials',
      checklist: check(['Units set and secured', 'Electrical connected', 'Refrigerant lines', 'Controls integrated', 'Commissioning'], 2),
    },
    {
      id: 'fr-6', code: 'FR-6006', jobId: 'job-4', crewId: 'crw-3', memberId: 'cm-8', occurredAt: at(-30, 15),
      workPerformed: 'Drained and removed both existing water heaters. Updated shutoffs and began venting modifications.',
      statusUpdate: 'Old units out, venting in progress.',
      notes: 'Shutoff window coordinated with on-site manager, residents notified.', hours: 8, materialsUsed: 'Shutoff valves, vent pipe',
      checklist: check(['Water shut off and notified', 'Old units removed', 'Venting modified'], 3),
    },
    {
      id: 'fr-7', code: 'FR-6007', jobId: 'job-4', crewId: 'crw-3', memberId: 'cm-8', occurredAt: at(-29, 14),
      workPerformed: 'Installed both 100-gallon heaters with expansion tanks, filled, purged and tested. Passed inspection.',
      statusUpdate: 'Complete and operational.',
      notes: '', hours: 7.5, materialsUsed: '2 water heaters, 2 expansion tanks',
      checklist: check(['Units installed', 'Expansion tanks set', 'System purged and tested', 'Inspection passed'], 4),
    },
    {
      id: 'fr-8', code: 'FR-6008', jobId: 'job-5', crewId: 'crw-2', memberId: 'cm-7', occurredAt: at(-24, 22),
      workPerformed: 'Baseline airflow readings taken at all six operatories. Identified two undersized branch runs.',
      statusUpdate: 'Diagnostic complete, modification plan confirmed.',
      notes: 'Work performed after 5pm per practice request.', hours: 5, materialsUsed: '',
      checklist: check(['Baseline readings taken', 'Problem runs identified', 'Plan confirmed with office'], 3),
    },
    {
      id: 'fr-9', code: 'FR-6009', jobId: 'job-5', crewId: 'crw-2', memberId: 'cm-7', occurredAt: at(-22, 21),
      workPerformed: 'Enlarged two branch runs, installed balancing dampers and re-tested all operatories.',
      statusUpdate: 'Balance complete, report prepared for the practice.',
      notes: '', hours: 6.5, materialsUsed: 'Balancing dampers, duct',
      checklist: check(['Duct modifications', 'Dampers installed', 'Re-test complete', 'Report delivered'], 4),
    },
    {
      id: 'fr-10', code: 'FR-6010', jobId: 'job-6', crewId: 'crw-4', memberId: 'cm-11', occurredAt: at(-9, 16),
      workPerformed: 'Kitchen demolition complete. Old cabinets, countertops and flooring removed and hauled off.',
      statusUpdate: 'Demo complete, electrical rough-in starts tomorrow.',
      notes: 'Found original subfloor in good condition.', hours: 8, materialsUsed: '',
      checklist: check(['Protection installed', 'Demolition complete', 'Debris hauled off'], 3),
    },
    {
      id: 'fr-11', code: 'FR-6011', jobId: 'job-6', crewId: 'crw-4', memberId: 'cm-13', occurredAt: at(-5, 16),
      workPerformed: 'Electrical rough-in for island and under-cabinet lighting. Drywall patched and primed.',
      statusUpdate: 'Rough-in inspected and passed. Ready for cabinets.',
      notes: '', hours: 8.5, materialsUsed: 'Romex, boxes, drywall compound',
      checklist: check(['Electrical rough-in', 'Inspection passed', 'Drywall patch and prime', 'Cabinets set'], 3),
    },
    {
      id: 'fr-12', code: 'FR-6012', jobId: 'job-6', crewId: 'crw-4', memberId: 'cm-12', occurredAt: at(-1, 15),
      workPerformed: 'Base and upper cabinets installed and leveled. Countertop template scheduled.',
      statusUpdate: 'Cabinets set. Countertop fabrication in progress.',
      notes: 'Template appointment confirmed for later this week.', hours: 9, materialsUsed: 'Cabinet package, shims, fasteners',
      checklist: check(['Base cabinets set', 'Upper cabinets set', 'Countertop templated', 'Backsplash installed'], 2),
    },
    {
      id: 'fr-13', code: 'FR-6013', jobId: 'job-7', crewId: 'crw-3', memberId: 'cm-9', occurredAt: at(-14, 16),
      workPerformed: 'Camera inspection located a collapsed section roughly 18 feet from the bay drain. Marked and cut concrete.',
      statusUpdate: 'Failure located, excavation started.',
      notes: 'Bay 3 closed to keep the shop operating.', hours: 8, materialsUsed: 'Concrete blades',
      checklist: check(['Camera inspection', 'Failure located', 'Concrete cut'], 3),
    },
    {
      id: 'fr-14', code: 'FR-6014', jobId: 'job-7', crewId: 'crw-3', memberId: 'cm-8', occurredAt: at(-13, 15),
      workPerformed: 'Replaced the collapsed pipe section, backfilled, patched the slab and re-ran the camera to confirm flow.',
      statusUpdate: 'Repair complete, line flows clear.',
      notes: '', hours: 8, materialsUsed: 'PVC pipe and fittings, concrete patch',
      checklist: check(['Pipe replaced', 'Backfill and compaction', 'Slab patched', 'Re-inspection clear'], 4),
    },
  ];
}

// ----------------------------------------------------------------- invoices

const INVOICE_TERMS = 'Payment due within 30 days of the invoice date. Please reference the invoice number with payment.';

function buildInvoices(today: Date): Invoice[] {
  const day = (offset: number) => dayOffset(today, offset);
  const stamp = (offset: number) => timeOffset(today, offset, 10, 0);

  return [
    {
      id: 'inv-1', code: 'INV-4001', customerId: 'cus-2', jobId: 'job-1', estimateId: 'est-1',
      status: 'Sent',
      items: [
        { id: 'ili-1', kind: 'Labor', description: 'Tear-off and disposal of existing shingles', quantity: 28, unit: 'sq ft', unitPrice: 12500 },
        { id: 'ili-2', kind: 'Materials', description: 'Architectural asphalt shingles, 30-year', quantity: 28, unit: 'sq ft', unitPrice: 18500 },
        { id: 'ili-3', kind: 'Materials', description: 'Synthetic underlayment and ice barrier', quantity: 1, unit: 'lot', unitPrice: 142000 },
        { id: 'ili-4', kind: 'Labor', description: 'Installation labor', quantity: 64, unit: 'hour', unitPrice: 8500 },
        { id: 'ili-5', kind: 'Disposal', description: 'Dumpster and haul-off', quantity: 1, unit: 'each', unitPrice: 68000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-59), dueAt: day(-29),
      notes: 'Thank you for your business.', terms: INVOICE_TERMS, createdAt: stamp(-59),
    },
    {
      id: 'inv-2', code: 'INV-4002', customerId: 'cus-5', jobId: 'job-4', estimateId: 'est-4',
      status: 'Sent',
      items: [
        { id: 'ili-6', kind: 'Equipment', description: '100-gallon commercial water heater', quantity: 2, unit: 'each', unitPrice: 428000 },
        { id: 'ili-7', kind: 'Materials', description: 'Expansion tanks, valves and venting', quantity: 1, unit: 'lot', unitPrice: 165000 },
        { id: 'ili-8', kind: 'Labor', description: 'Removal and installation', quantity: 26, unit: 'hour', unitPrice: 10500 },
        { id: 'ili-9', kind: 'Permit', description: 'Plumbing permit', quantity: 1, unit: 'each', unitPrice: 32000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-28), dueAt: day(2),
      notes: '', terms: INVOICE_TERMS, createdAt: stamp(-28),
    },
    {
      id: 'inv-3', code: 'INV-4003', customerId: 'cus-7', jobId: 'job-5', estimateId: 'est-5',
      status: 'Sent',
      items: [
        { id: 'ili-10', kind: 'Labor', description: 'Diagnostic and airflow testing', quantity: 8, unit: 'hour', unitPrice: 12500 },
        { id: 'ili-11', kind: 'Materials', description: 'Balancing dampers and duct materials', quantity: 1, unit: 'lot', unitPrice: 138000 },
        { id: 'ili-12', kind: 'Labor', description: 'Duct modification, after hours', quantity: 24, unit: 'hour', unitPrice: 14500 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-21), dueAt: day(-6),
      notes: 'Net 15 per practice agreement.', terms: INVOICE_TERMS, createdAt: stamp(-21),
    },
    {
      id: 'inv-4', code: 'INV-4004', customerId: 'cus-9', jobId: 'job-7', estimateId: 'est-7',
      status: 'Sent',
      items: [
        { id: 'ili-13', kind: 'Labor', description: 'Camera inspection and locate', quantity: 4, unit: 'hour', unitPrice: 11500 },
        { id: 'ili-14', kind: 'Labor', description: 'Concrete cut, excavation and repair', quantity: 22, unit: 'hour', unitPrice: 10500 },
        { id: 'ili-15', kind: 'Materials', description: 'Pipe, fittings and concrete patch', quantity: 1, unit: 'lot', unitPrice: 128000 },
        { id: 'ili-16', kind: 'Equipment', description: 'Hydro-jetting equipment', quantity: 1, unit: 'day', unitPrice: 78000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-12), dueAt: day(18),
      notes: '', terms: INVOICE_TERMS, createdAt: stamp(-12),
    },
    {
      id: 'inv-5', code: 'INV-4005', customerId: 'cus-1', jobId: undefined, estimateId: undefined,
      status: 'Sent',
      items: [
        { id: 'ili-17', kind: 'Labor', description: 'Quarterly preventive maintenance — Blake Street Lofts', quantity: 18, unit: 'hour', unitPrice: 11500 },
        { id: 'ili-18', kind: 'Materials', description: 'Filters and belts', quantity: 1, unit: 'lot', unitPrice: 48000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-45), dueAt: day(-15),
      notes: 'Quarterly maintenance agreement.', terms: INVOICE_TERMS, createdAt: stamp(-45),
    },
    {
      id: 'inv-6', code: 'INV-4006', customerId: 'cus-3', jobId: undefined, estimateId: undefined,
      status: 'Sent',
      items: [
        { id: 'ili-19', kind: 'Labor', description: 'Emergency roof leak repair — Building C', quantity: 6, unit: 'hour', unitPrice: 12500 },
        { id: 'ili-20', kind: 'Materials', description: 'Patch materials and sealant', quantity: 1, unit: 'lot', unitPrice: 34000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-36), dueAt: day(-6),
      notes: '', terms: INVOICE_TERMS, createdAt: stamp(-36),
    },
    {
      id: 'inv-7', code: 'INV-4007', customerId: 'cus-11', jobId: undefined, estimateId: undefined,
      status: 'Sent',
      items: [
        { id: 'ili-21', kind: 'Labor', description: 'Storefront door closer replacement and adjustment', quantity: 5, unit: 'hour', unitPrice: 11500 },
        { id: 'ili-22', kind: 'Materials', description: 'Commercial door closer', quantity: 2, unit: 'each', unitPrice: 42000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-8), dueAt: day(22),
      notes: '', terms: INVOICE_TERMS, createdAt: stamp(-8),
    },
    {
      id: 'inv-8', code: 'INV-4008', customerId: 'cus-4', jobId: 'job-6', estimateId: 'est-6',
      status: 'Draft',
      items: [
        { id: 'ili-23', kind: 'Labor', description: 'Demolition and disposal', quantity: 16, unit: 'hour', unitPrice: 7500 },
        { id: 'ili-24', kind: 'Materials', description: 'Cabinetry package', quantity: 1, unit: 'lot', unitPrice: 1480000 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-2), dueAt: day(28),
      notes: 'Progress billing — first draw for the kitchen remodel.', terms: INVOICE_TERMS, createdAt: stamp(-2),
    },
    {
      id: 'inv-9', code: 'INV-4009', customerId: 'cus-6', jobId: undefined, estimateId: undefined,
      status: 'Sent',
      items: [
        { id: 'ili-25', kind: 'Labor', description: 'Furnace diagnostic service call', quantity: 2, unit: 'hour', unitPrice: 12500 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-18), dueAt: day(12),
      notes: 'Diagnostic fee credited toward replacement if the estimate is accepted.',
      terms: INVOICE_TERMS, createdAt: stamp(-18),
    },
    {
      id: 'inv-10', code: 'INV-4010', customerId: 'cus-8', jobId: undefined, estimateId: undefined,
      status: 'Void',
      items: [
        { id: 'ili-26', kind: 'Service Fee', description: 'Trip charge — customer rescheduled on arrival', quantity: 1, unit: 'each', unitPrice: 9500 },
      ],
      taxRate: 8.81, discount: 0, issuedAt: day(-15), dueAt: day(15),
      notes: 'Voided as a courtesy. Customer rescheduled the same week.', terms: INVOICE_TERMS, createdAt: stamp(-15),
    },
  ];
}

/**
 * Payments are written so each invoice lands on a specific derived status:
 * INV-4001 and INV-4005 fully paid, INV-4002 and INV-4006 partially paid,
 * INV-4003 overdue with nothing received, the rest open.
 */
function buildPayments(today: Date): Payment[] {
  const day = (offset: number) => dayOffset(today, offset);

  return [
    { id: 'pay-1', code: 'PAY-5001', invoiceId: 'inv-1', customerId: 'cus-2', amount: 900000, receivedAt: day(-52), method: 'Check', reference: 'Check 2841' },
    { id: 'pay-2', code: 'PAY-5002', invoiceId: 'inv-1', customerId: 'cus-2', amount: 500000, receivedAt: day(-40), method: 'ACH', reference: 'Insurance proceeds' },
    { id: 'pay-3', code: 'PAY-5003', invoiceId: 'inv-1', customerId: 'cus-2', amount: 364898, receivedAt: day(-31), method: 'Card' },
    { id: 'pay-4', code: 'PAY-5004', invoiceId: 'inv-2', customerId: 'cus-5', amount: 700000, receivedAt: day(-16), method: 'ACH', reference: 'ACH 88102' },
    { id: 'pay-5', code: 'PAY-5005', invoiceId: 'inv-5', customerId: 'cus-1', amount: 100000, receivedAt: day(-38), method: 'ACH', reference: 'ACH 77410' },
    { id: 'pay-6', code: 'PAY-5006', invoiceId: 'inv-5', customerId: 'cus-1', amount: 177466, receivedAt: day(-26), method: 'ACH', reference: 'ACH 77655' },
    { id: 'pay-7', code: 'PAY-5007', invoiceId: 'inv-6', customerId: 'cus-3', amount: 50000, receivedAt: day(-20), method: 'Check', reference: 'Check 1194' },
    { id: 'pay-8', code: 'PAY-5008', invoiceId: 'inv-9', customerId: 'cus-6', amount: 27203, receivedAt: day(-10), method: 'Card' },
    { id: 'pay-9', code: 'PAY-5009', invoiceId: 'inv-7', customerId: 'cus-11', amount: 75000, receivedAt: day(-3), method: 'ACH', reference: 'ACH 90233' },
  ];
}

// --------------------------------------------------------------- follow-ups

function buildFollowUps(today: Date): FollowUp[] {
  const day = (offset: number) => dayOffset(today, offset);
  const stamp = (offset: number) => timeOffset(today, offset, 8, 30);

  return [
    { id: 'fu-1', code: 'TSK-7001', type: 'Follow up on estimate', title: 'Check in on Suite 120 build-out estimate', dueAt: day(2), relatesTo: { kind: 'estimate', id: 'est-8' }, done: false, assignedUserId: 'usr-2', createdAt: stamp(-5) },
    { id: 'fu-2', code: 'TSK-7002', type: 'Follow up on estimate', title: 'Call Ray Okafor about the panel upgrade', dueAt: day(1), relatesTo: { kind: 'estimate', id: 'est-9' }, done: false, assignedUserId: 'usr-2', createdAt: stamp(-4) },
    { id: 'fu-3', code: 'TSK-7003', type: 'Payment reminder', title: 'Foothills Dental invoice is past due', dueAt: day(-1), relatesTo: { kind: 'invoice', id: 'inv-3' }, done: false, assignedUserId: 'usr-1', createdAt: stamp(-3) },
    { id: 'fu-4', code: 'TSK-7004', type: 'Confirm job schedule', title: 'Confirm clubhouse re-roof start with the HOA board', dueAt: day(1), relatesTo: { kind: 'job', id: 'job-3' }, done: false, assignedUserId: 'usr-3', createdAt: stamp(-2) },
    { id: 'fu-5', code: 'TSK-7005', type: 'Call customer', title: 'Schedule bathroom remodel walkthrough', dueAt: day(1), relatesTo: { kind: 'lead', id: 'lead-11' }, done: false, assignedUserId: 'usr-2', createdAt: stamp(-2) },
    { id: 'fu-6', code: 'TSK-7006', type: 'Call customer', title: 'Furnace quote follow-up with Janet Whitmore', dueAt: day(0), relatesTo: { kind: 'lead', id: 'lead-12' }, done: false, assignedUserId: 'usr-2', createdAt: stamp(-1) },
    { id: 'fu-7', code: 'TSK-7007', type: 'Payment reminder', title: 'Sterling Ridge balance on emergency repair', dueAt: day(-2), relatesTo: { kind: 'invoice', id: 'inv-6' }, done: false, assignedUserId: 'usr-1', createdAt: stamp(-6) },
    { id: 'fu-8', code: 'TSK-7008', type: 'Site visit', title: 'Deck assessment at the Choi residence', dueAt: day(3), relatesTo: { kind: 'job', id: 'job-10' }, done: false, assignedUserId: 'usr-4', createdAt: stamp(-1) },
    { id: 'fu-9', code: 'TSK-7009', type: 'Call customer', title: 'Warehouse lighting retrofit — qualify scope', dueAt: day(1), relatesTo: { kind: 'lead', id: 'lead-15' }, done: false, assignedUserId: 'usr-2', createdAt: stamp(-1) },
    { id: 'fu-10', code: 'TSK-7010', type: 'Confirm job schedule', title: 'Confirm common area access badge with building management', dueAt: day(0), relatesTo: { kind: 'job', id: 'job-8' }, done: false, assignedUserId: 'usr-3', createdAt: stamp(-1) },
    { id: 'fu-11', code: 'TSK-7011', type: 'Call customer', title: 'Thank Elaine Brooks and request a review', dueAt: day(-8), relatesTo: { kind: 'customer', id: 'cus-2' }, done: true, assignedUserId: 'usr-2', createdAt: stamp(-20) },
  ];
}

// ------------------------------------------------------------------ activity

/**
 * Activity history is derived from the records above rather than hand-written,
 * so the timeline can never describe something the data does not contain.
 * New events are appended by the reducer as a visitor works.
 */
function buildActivity(
  leads: Lead[],
  estimates: Estimate[],
  jobs: Job[],
  fieldRecords: FieldRecord[],
  invoices: Invoice[],
  payments: Payment[],
  customers: Customer[],
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  let sequence = 0;
  const push = (event: Omit<ActivityEvent, 'id'>) => {
    sequence += 1;
    events.push({ ...event, id: `act-${sequence}` });
  };

  const customerRef = (id: string) => ({ kind: 'customer' as const, id });
  /** Offsets an anchor timestamp by minutes so same-record events keep their order. */
  const after = (iso: string, minutes: number) =>
    new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

  for (const lead of leads) {
    push({
      at: lead.createdAt, kind: 'lead.created', subject: { kind: 'lead', id: lead.id },
      related: lead.customerId ? [customerRef(lead.customerId)] : [],
      summary: `Lead ${lead.code} created from ${lead.source.toLowerCase()}.`, actorId: lead.assignedUserId,
    });
    if (lead.stage !== 'New') {
      push({
        at: after(lead.createdAt, 180), kind: 'lead.stage', subject: { kind: 'lead', id: lead.id },
        related: lead.customerId ? [customerRef(lead.customerId)] : [],
        summary: `Stage set to ${lead.stage}.`, actorId: lead.assignedUserId,
      });
    }
  }

  for (const customer of customers) {
    push({
      at: `${customer.customerSince}T09:00:00.000Z`, kind: 'customer.created',
      subject: customerRef(customer.id), related: [],
      summary: `Customer record created for ${customer.name}.`, actorId: 'usr-2',
    });
  }

  for (const estimate of estimates) {
    const ref = { kind: 'estimate' as const, id: estimate.id };
    push({
      at: estimate.createdAt, kind: 'estimate.created', subject: ref,
      related: [customerRef(estimate.customerId)],
      summary: `Estimate ${estimate.code} created.`, actorId: 'usr-2',
    });
    if (estimate.status !== 'Draft') {
      push({
        at: after(estimate.createdAt, 90), kind: 'estimate.sent', subject: ref,
        related: [customerRef(estimate.customerId)],
        summary: `Estimate ${estimate.code} sent to the customer.`, actorId: 'usr-2',
      });
    }
    if (estimate.status === 'Accepted') {
      push({
        at: after(estimate.createdAt, 2880), kind: 'estimate.accepted', subject: ref,
        related: [customerRef(estimate.customerId)],
        summary: `Estimate ${estimate.code} accepted.`, actorId: 'usr-2',
      });
    }
    if (estimate.status === 'Declined') {
      push({
        at: after(estimate.createdAt, 2880), kind: 'estimate.declined', subject: ref,
        related: [customerRef(estimate.customerId)],
        summary: `Estimate ${estimate.code} declined.`, actorId: 'usr-2',
      });
    }
  }

  for (const job of jobs) {
    const ref = { kind: 'job' as const, id: job.id };
    const related = [customerRef(job.customerId)];
    if (job.estimateId) related.push({ kind: 'estimate', id: job.estimateId } as never);

    push({
      at: job.createdAt, kind: 'job.created', subject: ref, related,
      summary: `Job ${job.code} created${job.estimateId ? ' from an accepted estimate' : ''}.`, actorId: 'usr-3',
    });
    if (job.scheduledStart) {
      push({
        at: after(job.createdAt, 60), kind: 'job.scheduled', subject: ref, related,
        summary: `Scheduled to start ${new Date(job.scheduledStart).toLocaleDateString('en-US')}.`, actorId: 'usr-3',
      });
    }
    if (job.crewId) {
      push({
        at: after(job.createdAt, 75), kind: 'job.crew', subject: ref,
        related: [...related, { kind: 'crew', id: job.crewId } as never],
        summary: `Crew assigned to ${job.code}.`, actorId: 'usr-3',
      });
    }
    if (job.status === 'In Progress' || job.status === 'Completed') {
      push({
        at: job.scheduledStart ?? job.createdAt, kind: 'job.started', subject: ref, related,
        summary: `Work started on ${job.code}.`, actorId: 'usr-4',
      });
    }
    if (job.status === 'On Hold') {
      push({
        at: after(job.createdAt, 2880), kind: 'job.hold', subject: ref, related,
        summary: `${job.code} placed on hold.`, actorId: 'usr-3',
      });
    }
    if (job.completedAt) {
      push({
        at: job.completedAt, kind: 'job.completed', subject: ref, related,
        summary: `${job.code} marked complete.`, actorId: 'usr-4',
      });
    }
  }

  for (const record of fieldRecords) {
    const job = jobs.find((candidate) => candidate.id === record.jobId);
    push({
      at: record.occurredAt, kind: 'field.added', subject: { kind: 'job', id: record.jobId },
      related: job ? [customerRef(job.customerId)] : [],
      summary: `Field record ${record.code} added — ${record.statusUpdate}`, actorId: 'usr-4',
    });
  }

  for (const invoice of invoices) {
    const ref = { kind: 'invoice' as const, id: invoice.id };
    const related = [customerRef(invoice.customerId)];
    if (invoice.jobId) related.push({ kind: 'job', id: invoice.jobId } as never);

    push({
      at: invoice.createdAt, kind: 'invoice.created', subject: ref, related,
      summary: `Invoice ${invoice.code} created.`, actorId: 'usr-1',
    });
    if (invoice.status !== 'Draft') {
      push({
        at: after(invoice.createdAt, 45), kind: 'invoice.sent', subject: ref, related,
        summary: `Invoice ${invoice.code} sent to the customer.`, actorId: 'usr-1',
      });
    }
    if (invoice.status === 'Void') {
      push({
        at: after(invoice.createdAt, 1440), kind: 'invoice.void', subject: ref, related,
        summary: `Invoice ${invoice.code} voided.`, actorId: 'usr-1',
      });
    }
  }

  for (const payment of payments) {
    const invoice = invoices.find((candidate) => candidate.id === payment.invoiceId);
    push({
      at: `${payment.receivedAt}T15:00:00.000Z`, kind: 'payment.recorded',
      subject: { kind: 'invoice', id: payment.invoiceId },
      related: [customerRef(payment.customerId), { kind: 'payment', id: payment.id }],
      summary: `Payment ${payment.code} recorded${invoice ? ` against ${invoice.code}` : ''} by ${payment.method.toLowerCase()}.`,
      actorId: 'usr-1',
    });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------- assembly

/**
 * Builds the full seed workspace.
 *
 * `today` is injected rather than read from the clock so unit tests can pin a
 * date and get byte-identical data.
 */
export function buildSeedState(today: Date = new Date()): ContractorState {
  const customers = buildCustomers(today);
  const leads = buildLeads(today);
  const estimates = buildEstimates(today);
  const jobs = buildJobs(today);
  const fieldRecords = buildFieldRecords(today);
  const invoices = buildInvoices(today);
  const payments = buildPayments(today);
  const followUps = buildFollowUps(today);

  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: new Date(today).toISOString(),
    settings: {
      companyName: 'Northline Contracting',
      legalLine: 'Northline Contracting LLC',
      phone: '(303) 555-0100',
      email: 'office@northlinecontracting.example',
      address: address('4820 N Washington St', 'Denver', '80216', 'Unit B'),
      license: 'CO-GC-114820',
      defaultTaxRate: 8.81,
      paymentTermsDays: 30,
      estimateValidityDays: 30,
      defaultTerms: DEFAULT_TERMS,
    },
    users,
    leads,
    customers,
    locations,
    estimates,
    jobs,
    crews,
    crewMembers,
    fieldRecords,
    invoices,
    payments,
    activity: buildActivity(leads, estimates, jobs, fieldRecords, invoices, payments, customers),
    followUps,
    counters: {
      lead: 1018,
      customer: 1013,
      location: 1019,
      estimate: 2014,
      job: 3011,
      invoice: 4011,
      payment: 5010,
      field: 6015,
      followUp: 7012,
    },
  };
}

/** Today at midnight, so a session that crosses midnight stays consistent. */
export function seedToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export const SEED_TODAY_ISO = () => toDateOnly(seedToday());
