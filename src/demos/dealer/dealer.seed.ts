import type {
  ActivityEvent,
  Customer,
  Deal,
  DealerLead,
  DealerLocation,
  DealerState,
  DocumentRecord,
  FinancingApplication,
  Payment,
  Reservation,
  Salesperson,
  Task,
  Vehicle,
} from './dealer.types';
import { COMMITTED_DEAL_STATUSES } from './dealer.types';
import { SCHEMA_VERSION } from './dealer.storage';
import { dayOffset, demoVin, formatCode, startOfDay, timeOffset } from './dealer.utils';

/**
 * Seed workspace for Summit Auto & Motors — a fictional dealership.
 *
 * Every date is expressed as an offset from a supplied "today", so the
 * workspace is never stale and never depends on when this file was written. The
 * offsets are fixed rather than random: a demo that reshuffles itself on each
 * visit cannot be screenshotted, tested or talked through.
 *
 * Nothing here describes a real business, a real person or a real vehicle. The
 * identifiers follow VIN formatting so the interface reads correctly; they do
 * not decode to anything.
 */

/** Midnight today. Every seed date is relative to this. */
export function seedToday(): Date {
  return startOfDay(new Date());
}

const LOCATIONS: DealerLocation[] = [
  {
    id: 'loc-main',
    name: 'Summit Main Lot',
    address: { line1: '4180 Wadsworth Blvd', city: 'Wheat Ridge', state: 'CO', zip: '80033' },
    phone: '(303) 555-0110',
  },
  {
    id: 'loc-powersports',
    name: 'Summit Powersports',
    address: { line1: '915 Nome St', city: 'Aurora', state: 'CO', zip: '80010' },
    phone: '(303) 555-0142',
  },
];

const SALESPEOPLE: Salesperson[] = [
  { id: 'sp-1', name: 'Alicia Romero', title: 'General Manager', role: 'owner', locationId: 'loc-main' },
  { id: 'sp-2', name: 'Brandon Teague', title: 'Sales Manager', role: 'sales_manager', locationId: 'loc-main' },
  { id: 'sp-3', name: 'Priya Raman', title: 'Finance Manager', role: 'finance', locationId: 'loc-main' },
  { id: 'sp-4', name: 'Marcus Webb', title: 'Sales Consultant', role: 'sales', locationId: 'loc-main' },
  { id: 'sp-5', name: 'Kara Lindqvist', title: 'Sales Consultant', role: 'sales', locationId: 'loc-powersports' },
  { id: 'sp-6', name: 'Devon Ellis', title: 'Inventory Coordinator', role: 'operations', locationId: 'loc-main' },
];

/** Compact vehicle description: the fields that vary, in a fixed order. */
type VehicleSpec = [
  year: number,
  make: string,
  model: string,
  trim: string,
  type: Vehicle['type'],
  mileage: number,
  exterior: string,
  interior: string,
  transmission: Vehicle['transmission'],
  fuel: Vehicle['fuelType'],
  condition: Vehicle['condition'],
  costDollars: number,
  priceDollars: number,
  acquiredDaysAgo: number,
  location: string,
];

const VEHICLE_SPECS: VehicleSpec[] = [
  [2021, 'Toyota', 'RAV4', 'XLE', 'SUV', 38_420, 'Magnetic Gray', 'Black', 'Automatic', 'Gasoline', 'Used', 21_400, 26_985, 41, 'loc-main'],
  [2020, 'Honda', 'Accord', 'Sport', 'Sedan', 46_180, 'Modern Steel', 'Gray', 'CVT', 'Gasoline', 'Used', 18_200, 22_450, 68, 'loc-main'],
  [2022, 'Ford', 'F-150', 'XLT SuperCrew', 'Truck', 29_640, 'Oxford White', 'Medium Earth', 'Automatic', 'Gasoline', 'Certified Pre-Owned', 33_800, 41_900, 23, 'loc-main'],
  [2019, 'Subaru', 'Outback', 'Premium', 'SUV', 64_310, 'Crystal Black', 'Slate', 'CVT', 'Gasoline', 'Used', 15_900, 20_480, 96, 'loc-main'],
  [2023, 'Tesla', 'Model 3', 'Long Range', 'Sedan', 12_050, 'Pearl White', 'Black', 'Single-speed', 'Electric', 'Used', 29_500, 35_900, 17, 'loc-main'],
  [2018, 'Jeep', 'Wrangler', 'Sahara', 'SUV', 78_220, 'Firecracker Red', 'Black', 'Automatic', 'Gasoline', 'Used', 22_100, 27_650, 112, 'loc-main'],
  [2021, 'Chevrolet', 'Silverado 1500', 'LT', 'Truck', 44_870, 'Summit White', 'Jet Black', 'Automatic', 'Gasoline', 'Used', 30_200, 36_800, 55, 'loc-main'],
  [2020, 'Mazda', 'CX-5', 'Touring', 'SUV', 41_930, 'Soul Red', 'Black', 'Automatic', 'Gasoline', 'Used', 19_400, 24_300, 34, 'loc-main'],
  [2022, 'Hyundai', 'Tucson', 'SEL', 'SUV', 26_510, 'Amazon Gray', 'Gray', 'Automatic', 'Gasoline', 'Certified Pre-Owned', 22_600, 27_950, 29, 'loc-main'],
  [2017, 'Nissan', 'Altima', 'SV', 'Sedan', 92_460, 'Gun Metallic', 'Charcoal', 'CVT', 'Gasoline', 'Used', 8_900, 12_400, 138, 'loc-main'],
  [2023, 'Toyota', 'Tacoma', 'TRD Off-Road', 'Truck', 18_240, 'Lunar Rock', 'Black', 'Automatic', 'Gasoline', 'Certified Pre-Owned', 34_900, 42_600, 12, 'loc-main'],
  [2019, 'Volkswagen', 'Golf GTI', 'S', 'Coupe', 57_180, 'Deep Black', 'Titan Black', 'Manual', 'Gasoline', 'Used', 16_300, 21_200, 74, 'loc-main'],
  [2021, 'Ram', 'ProMaster 1500', 'Cargo', 'Van', 51_330, 'Bright White', 'Gray', 'Automatic', 'Gasoline', 'Used', 24_800, 30_400, 62, 'loc-main'],
  [2022, 'Kia', 'Telluride', 'EX', 'SUV', 31_770, 'Ebony Black', 'Black', 'Automatic', 'Gasoline', 'Used', 32_100, 38_900, 26, 'loc-main'],
  [2020, 'BMW', '330i', 'xDrive', 'Sedan', 43_920, 'Alpine White', 'Cognac', 'Automatic', 'Gasoline', 'Used', 24_700, 30_750, 49, 'loc-main'],
  [2018, 'Ford', 'Escape', 'SE', 'SUV', 84_610, 'Ingot Silver', 'Charcoal', 'Automatic', 'Gasoline', 'Used', 10_400, 14_300, 121, 'loc-main'],
  [2023, 'Honda', 'CR-V', 'EX-L', 'SUV', 14_880, 'Meteorite Gray', 'Black', 'CVT', 'Hybrid', 'Certified Pre-Owned', 29_800, 35_400, 19, 'loc-main'],
  [2021, 'GMC', 'Sierra 1500', 'Elevation', 'Truck', 39_450, 'Onyx Black', 'Jet Black', 'Automatic', 'Gasoline', 'Used', 31_500, 38_200, 58, 'loc-main'],
  [2019, 'Chevrolet', 'Bolt EV', 'LT', 'Sedan', 48_760, 'Kinetic Blue', 'Dark Gray', 'Single-speed', 'Electric', 'Used', 12_800, 17_100, 87, 'loc-main'],
  [2022, 'Ford', 'Transit 250', 'Medium Roof', 'Van', 34_210, 'Agate Black', 'Dark Palazzo', 'Automatic', 'Gasoline', 'Used', 33_400, 40_100, 37, 'loc-main'],
  [2020, 'Harley-Davidson', 'Street Glide', 'Special', 'Motorcycle', 12_340, 'Vivid Black', 'Black', 'Manual', 'Gasoline', 'Used', 16_900, 21_800, 45, 'loc-powersports'],
  [2022, 'Yamaha', 'MT-07', 'Base', 'Motorcycle', 4_120, 'Team Yamaha Blue', 'Black', 'Manual', 'Gasoline', 'Used', 6_400, 8_450, 31, 'loc-powersports'],
  [2021, 'Kawasaki', 'Ninja 650', 'ABS', 'Motorcycle', 7_980, 'Metallic Spark Black', 'Black', 'Manual', 'Gasoline', 'Used', 5_900, 7_990, 66, 'loc-powersports'],
  [2023, 'Polaris', 'RZR Trail', 'Sport', 'Powersports', 1_240, 'Ghost Gray', 'Black', 'Automatic', 'Gasoline', 'Used', 14_200, 18_600, 22, 'loc-powersports'],
  [2020, 'Can-Am', 'Outlander 570', 'DPS', 'Powersports', 2_870, 'Mossy Oak', 'Black', 'Automatic', 'Gasoline', 'Used', 6_100, 8_300, 79, 'loc-powersports'],
  [2019, 'Honda', 'Odyssey', 'EX-L', 'Van', 71_450, 'Pacific Pewter', 'Gray', 'Automatic', 'Gasoline', 'Used', 19_800, 25_200, 104, 'loc-main'],
  [2021, 'Lexus', 'RX 350', 'Premium', 'SUV', 36_120, 'Nebula Gray', 'Black', 'Automatic', 'Gasoline', 'Used', 34_600, 41_400, 51, 'loc-main'],
  [2018, 'Toyota', 'Camry', 'LE', 'Sedan', 88_340, 'Celestial Silver', 'Ash', 'Automatic', 'Gasoline', 'Used', 12_600, 16_900, 129, 'loc-main'],
  [2022, 'Nissan', 'Frontier', 'SV', 'Truck', 27_910, 'Boulder Gray', 'Charcoal', 'Automatic', 'Gasoline', 'Used', 26_400, 32_100, 28, 'loc-main'],
  [2023, 'Subaru', 'Crosstrek', 'Sport', 'SUV', 11_620, 'Sun Blaze Pearl', 'Gray', 'CVT', 'Gasoline', 'Certified Pre-Owned', 25_300, 30_800, 15, 'loc-main'],
];

function buildVehicles(today: Date): Vehicle[] {
  return VEHICLE_SPECS.map((spec, index) => {
    const [
      year, make, model, trim, type, mileage, exteriorColor, interiorColor,
      transmission, fuelType, condition, cost, price, acquiredDaysAgo, locationId,
    ] = spec;

    return {
      id: `veh-${index + 1}`,
      code: formatCode('vehicle', 2001 + index),
      vin: demoVin(index + 1),
      year,
      make,
      model,
      trim,
      type,
      mileage,
      exteriorColor,
      interiorColor,
      transmission,
      fuelType,
      condition,
      acquisitionCost: cost * 100,
      listPrice: price * 100,
      locationId,
      status: 'In Stock',
      acquiredAt: dayOffset(today, -acquiredDaysAgo),
    };
  });
}

type LeadSpec = [
  name: string,
  phone: string,
  email: string,
  source: DealerLead['source'],
  stage: DealerLead['stage'],
  vehicleIndex: number | null,
  budgetMin: number,
  budgetMax: number,
  contact: DealerLead['contactPreference'],
  trade: boolean,
  salesperson: string,
  createdDaysAgo: number,
  followUpInDays: number | null,
  notes: string,
];

const LEAD_SPECS: LeadSpec[] = [
  ['Renata Alvarez', '(303) 555-0161', 'renata.alvarez@example.com', 'Website', 'New', 1, 24_000, 29_000, 'Email', false, 'sp-4', 1, 1, 'Asked about the RAV4 through the website form. Wants to know about remaining warranty.'],
  ['Trevor Nakamura', '(720) 555-0114', 'trevor.nakamura@example.com', 'Marketplace Listing', 'Contacted', 3, 38_000, 44_000, 'Phone', true, 'sp-4', 4, 1, 'Trading a 2015 Tundra. Wants a number on the trade before coming in.'],
  ['Dominique Carter', '(303) 555-0187', 'dominique.carter@example.com', 'Referral', 'Appointment', 5, 32_000, 37_000, 'Text', false, 'sp-2', 6, 0, 'Coming in Saturday morning to see the Model 3.'],
  ['Hollis Grant', '(720) 555-0155', 'hollis.grant@example.com', 'Walk-in', 'Vehicle Selected', 11, 40_000, 45_000, 'Phone', false, 'sp-2', 9, 2, 'Test drove the Tacoma twice. Deciding between trims.'],
  ['Saoirse Whelan', '(303) 555-0173', 'saoirse.whelan@example.com', 'Website', 'Negotiation', 14, 36_000, 40_000, 'Email', true, 'sp-4', 12, 1, 'Wants the Telluride at a specific monthly payment. Finance desk is involved.'],
  ['Emmett Boyle', '(720) 555-0198', 'emmett.boyle@example.com', 'Phone Inquiry', 'Contacted', 21, 20_000, 23_000, 'Phone', false, 'sp-5', 3, 2, 'Long-time rider looking at the Street Glide. Asked about service history.'],
  ['Marisol Reyes', '(303) 555-0122', 'marisol.reyes@example.com', 'Social Media', 'New', 22, 7_500, 9_000, 'Text', false, 'sp-5', 2, 1, 'First bike. Asked whether the MT-07 is beginner friendly.'],
  ['Grady Sutton', '(720) 555-0139', 'grady.sutton@example.com', 'Repeat Customer', 'Appointment', 18, 35_000, 40_000, 'Phone', true, 'sp-2', 7, 1, 'Bought from us in 2021. Looking at the Sierra, trading the old one in.'],
  ['Priyanka Deshpande', '(303) 555-0144', 'priyanka.deshpande@example.com', 'Website', 'Contacted', 17, 33_000, 37_000, 'Email', false, 'sp-4', 5, 3, 'Interested in the CR-V hybrid. Comparing against a new one.'],
  ['Wendell Fisk', '(720) 555-0176', 'wendell.fisk@example.com', 'Trade Event', 'New', 24, 17_000, 20_000, 'Phone', false, 'sp-5', 3, 2, 'Met at the spring powersports show. Wants to see the RZR in person.'],
  ['Bianca Solomon', '(303) 555-0108', 'bianca.solomon@example.com', 'Referral', 'Vehicle Selected', 27, 39_000, 43_000, 'Email', false, 'sp-2', 14, 1, 'Referred by an existing customer. Set on the RX 350.'],
  ['Kwame Boateng', '(720) 555-0163', 'kwame.boateng@example.com', 'Marketplace Listing', 'Contacted', 9, 26_000, 30_000, 'Text', false, 'sp-4', 8, 2, 'Fleet buyer. May want two Tucsons if the numbers work.'],
  ['Lucia Ferrante', '(303) 555-0195', 'lucia.ferrante@example.com', 'Walk-in', 'Lost', 10, 11_000, 13_000, 'Phone', false, 'sp-4', 26, null, 'Bought elsewhere. Wanted a lower mileage Altima than we had.'],
  ['Aurelio Vance', '(720) 555-0127', 'aurelio.vance@example.com', 'Website', 'New', 29, 30_000, 34_000, 'Email', false, 'sp-2', 1, 1, 'Asked about the Frontier and whether a bedliner is included.'],
  ['Tamsin Kelleher', '(303) 555-0181', 'tamsin.kelleher@example.com', 'Phone Inquiry', 'Appointment', 29, 29_000, 32_000, 'Phone', true, 'sp-4', 4, 0, 'Booked a Crosstrek test drive for this afternoon.'],
  ['Osvaldo Marin', '(720) 555-0150', 'osvaldo.marin@example.com', 'Repeat Customer', 'Won', 2, 21_000, 24_000, 'Phone', false, 'sp-2', 38, null, 'Second purchase from us. Took the Accord.'],
  ['Naomi Sandoval', '(303) 555-0118', 'naomi.sandoval@example.com', 'Website', 'Won', 8, 23_000, 26_000, 'Email', false, 'sp-4', 31, null, 'Bought the CX-5 after two visits.'],
  ['Caleb Ortiz', '(720) 555-0192', 'caleb.ortiz@example.com', 'Referral', 'Won', 13, 29_000, 33_000, 'Phone', false, 'sp-2', 24, null, 'Needed a work van. Took the ProMaster.'],
  ['Sylvie Marchand', '(303) 555-0136', 'sylvie.marchand@example.com', 'Social Media', 'Reservation', 23, 7_500, 8_500, 'Text', false, 'sp-5', 11, 1, 'Reserved the Ninja 650 while arranging financing.'],
  ['Idris Bello', '(720) 555-0147', 'idris.bello@example.com', 'Walk-in', 'Reservation', 4, 19_000, 22_000, 'Phone', false, 'sp-4', 8, 2, 'Holding the Outback until payday.'],
  ['Fern Whitlock', '(303) 555-0129', 'fern.whitlock@example.com', 'Website', 'Lost', 19, 15_000, 18_000, 'Email', false, 'sp-4', 33, null, 'Decided to keep her current car for another year.'],
  ['Rashida Kone', '(720) 555-0184', 'rashida.kone@example.com', 'Marketplace Listing', 'Negotiation', 7, 34_000, 38_000, 'Email', true, 'sp-2', 10, 1, 'Wants more for her trade before she signs on the Silverado.'],
];

type CustomerSpec = [
  name: string,
  phone: string,
  email: string,
  line1: string,
  city: string,
  zip: string,
  sinceDaysAgo: number,
  leadIndex: number | null,
  notes: string,
];

const CUSTOMER_SPECS: CustomerSpec[] = [
  ['Osvaldo Marin', '(720) 555-0150', 'osvaldo.marin@example.com', '2210 Depew St', 'Lakewood', '80214', 38, 15, 'Second purchase. Prefers a call over email.'],
  ['Naomi Sandoval', '(303) 555-0118', 'naomi.sandoval@example.com', '7744 W 38th Ave', 'Wheat Ridge', '80033', 31, 16, ''],
  ['Caleb Ortiz', '(720) 555-0192', 'caleb.ortiz@example.com', '1560 Clay St', 'Denver', '80204', 24, 17, 'Runs a small contracting outfit; buys work vans.'],
  ['Sylvie Marchand', '(303) 555-0136', 'sylvie.marchand@example.com', '885 Ironton St', 'Aurora', '80010', 11, 18, ''],
  ['Idris Bello', '(720) 555-0147', 'idris.bello@example.com', '3021 S Sheridan Blvd', 'Denver', '80227', 8, 19, ''],
  ['Rashida Kone', '(720) 555-0184', 'rashida.kone@example.com', '4419 Zenobia St', 'Denver', '80212', 10, 21, 'Trade valuation still under discussion.'],
  ['Hollis Grant', '(720) 555-0155', 'hollis.grant@example.com', '12240 W 64th Pl', 'Arvada', '80004', 9, 3, ''],
  ['Saoirse Whelan', '(303) 555-0173', 'saoirse.whelan@example.com', '6708 Carr St', 'Arvada', '80004', 12, 4, ''],
  ['Bianca Solomon', '(303) 555-0108', 'bianca.solomon@example.com', '9915 E Hampden Ave', 'Denver', '80231', 14, 10, ''],
  ['Grady Sutton', '(720) 555-0139', 'grady.sutton@example.com', '1130 Dover St', 'Lakewood', '80215', 7, 7, 'Bought a Sierra from us in 2021.'],
  ['Marguerite Oyelaran', '(303) 555-0166', 'marguerite.oyelaran@example.com', '2875 S Federal Blvd', 'Denver', '80236', 187, null, 'Long-standing customer. Services both vehicles with us.'],
  ['Desmond Kirby', '(720) 555-0171', 'desmond.kirby@example.com', '5540 Newland St', 'Arvada', '80002', 152, null, ''],
  ['Annika Sorenson', '(303) 555-0159', 'annika.sorenson@example.com', '1808 Estes St', 'Lakewood', '80215', 96, null, ''],
  ['Ravi Chandrasekar', '(720) 555-0102', 'ravi.chandrasekar@example.com', '4477 Depew St', 'Denver', '80212', 64, null, 'Fleet contact for a local delivery company.'],
  ['Colette Baptiste', '(303) 555-0193', 'colette.baptiste@example.com', '760 Galena St', 'Aurora', '80010', 43, null, ''],
  ['Terrence Aldridge', '(720) 555-0125', 'terrence.aldridge@example.com', '3312 W 72nd Ave', 'Westminster', '80030', 29, null, ''],
];

export function buildSeedState(today: Date): DealerState {
  const vehicles = buildVehicles(today);
  const v = (index: number) => vehicles[index].id;

  const leads: DealerLead[] = LEAD_SPECS.map((spec, index) => {
    const [
      name, phone, email, source, stage, vehicleIndex, budgetMin, budgetMax,
      contactPreference, hasTradeIn, salespersonId, createdDaysAgo, followUpInDays, notes,
    ] = spec;

    return {
      id: `lead-${index + 1}`,
      code: formatCode('lead', 1001 + index),
      name,
      phone,
      email,
      source,
      stage,
      vehicleId: vehicleIndex === null ? undefined : v(vehicleIndex),
      alsoInterestedIn: index === 3 ? [v(18)] : index === 11 ? [v(8)] : [],
      budgetMin: budgetMin * 100,
      budgetMax: budgetMax * 100,
      contactPreference,
      hasTradeIn,
      salespersonId,
      appointmentAt:
        stage === 'Appointment' ? timeOffset(today, index === 2 ? 2 : index === 7 ? 1 : 0, 10, 30) : undefined,
      appointmentKind:
        stage === 'Appointment' ? (index === 14 ? 'Test drive' : 'Showroom visit') : undefined,
      nextFollowUpAt: followUpInDays === null ? undefined : dayOffset(today, followUpInDays),
      notes,
      createdAt: timeOffset(today, -createdDaysAgo, 9, 15),
    };
  });

  const customers: Customer[] = CUSTOMER_SPECS.map((spec, index) => {
    const [name, phone, email, line1, city, zip, sinceDaysAgo, leadIndex, notes] = spec;
    return {
      id: `cus-${index + 1}`,
      code: formatCode('customer', 3001 + index),
      name,
      phone,
      email,
      address: { line1, city, state: 'CO', zip },
      leadId: leadIndex === null ? undefined : `lead-${leadIndex + 1}`,
      customerSince: dayOffset(today, -sinceDaysAgo),
      notes,
    };
  });

  // Link the leads that became customers back to their record.
  for (const customer of customers) {
    if (!customer.leadId) continue;
    const lead = leads.find((entry) => entry.id === customer.leadId);
    if (lead) lead.customerId = customer.id;
  }

  const reservations: Reservation[] = [
    { id: 'res-1', code: formatCode('reservation', 5001), customerId: 'cus-4', vehicleId: v(22), salespersonId: 'sp-5', status: 'Confirmed', reservedAt: dayOffset(today, -6), expiresAt: dayOffset(today, 2), requestedDeposit: 50_000, notes: 'Holding while financing is arranged.' },
    { id: 'res-2', code: formatCode('reservation', 5002), customerId: 'cus-5', vehicleId: v(3), salespersonId: 'sp-4', status: 'Confirmed', reservedAt: dayOffset(today, -4), expiresAt: dayOffset(today, 4), requestedDeposit: 75_000, notes: 'Deposit taken in person.' },
    { id: 'res-3', code: formatCode('reservation', 5003), customerId: 'cus-7', vehicleId: v(10), salespersonId: 'sp-2', status: 'Pending', reservedAt: dayOffset(today, -1), expiresAt: dayOffset(today, 6), requestedDeposit: 100_000, notes: 'Awaiting the deposit.' },
    { id: 'res-4', code: formatCode('reservation', 5004), customerId: 'cus-9', vehicleId: v(26), salespersonId: 'sp-2', status: 'Confirmed', reservedAt: dayOffset(today, -9), expiresAt: dayOffset(today, 1), requestedDeposit: 100_000, notes: 'Expires soon — needs a call.' },
    { id: 'res-5', code: formatCode('reservation', 5005), customerId: 'cus-6', vehicleId: v(6), salespersonId: 'sp-2', status: 'Pending', reservedAt: dayOffset(today, -2), expiresAt: dayOffset(today, 5), requestedDeposit: 75_000, notes: 'Trade valuation pending.' },
    { id: 'res-6', code: formatCode('reservation', 5006), customerId: 'cus-16', vehicleId: v(19), salespersonId: 'sp-4', status: 'Expired', reservedAt: dayOffset(today, -24), expiresAt: dayOffset(today, -10), requestedDeposit: 50_000, notes: 'Customer went quiet.' },
    { id: 'res-7', code: formatCode('reservation', 5007), customerId: 'cus-15', vehicleId: v(15), salespersonId: 'sp-4', status: 'Cancelled', reservedAt: dayOffset(today, -18), expiresAt: dayOffset(today, -4), requestedDeposit: 50_000, notes: 'Changed their mind about the size.' },
    { id: 'res-8', code: formatCode('reservation', 5008), customerId: 'cus-1', vehicleId: v(1), salespersonId: 'sp-2', status: 'Converted to Deal', reservedAt: dayOffset(today, -40), expiresAt: dayOffset(today, -33), requestedDeposit: 50_000, dealId: 'deal-1', notes: '' },
    { id: 'res-9', code: formatCode('reservation', 5009), customerId: 'cus-2', vehicleId: v(7), salespersonId: 'sp-4', status: 'Converted to Deal', reservedAt: dayOffset(today, -33), expiresAt: dayOffset(today, -26), requestedDeposit: 50_000, dealId: 'deal-2', notes: '' },
    { id: 'res-10', code: formatCode('reservation', 5010), customerId: 'cus-3', vehicleId: v(12), salespersonId: 'sp-2', status: 'Converted to Deal', reservedAt: dayOffset(today, -26), expiresAt: dayOffset(today, -19), requestedDeposit: 100_000, dealId: 'deal-3', notes: '' },
  ];

  const deals: Deal[] = [
    { id: 'deal-1', code: formatCode('deal', 7001), customerId: 'cus-1', vehicleId: v(1), salespersonId: 'sp-2', reservationId: 'res-8', status: 'Closed', plan: 'Financing', salePrice: 2_245_000, discount: 45_000, fees: [{ id: 'fee-1', label: 'Dealer handling', amount: 59_900 }, { id: 'fee-2', label: 'Title and registration', amount: 34_500 }], taxRate: 8.81, downPayment: 400_000, openedAt: dayOffset(today, -37), closedAt: dayOffset(today, -30), notes: '', delivery: { vehicleReady: true, documentsSigned: true, paymentConfirmed: true, insuranceProvided: true, keysHandedOver: true, completedAt: dayOffset(today, -29), notes: 'Delivered on a Saturday morning.' } },
    { id: 'deal-2', code: formatCode('deal', 7002), customerId: 'cus-2', vehicleId: v(7), salespersonId: 'sp-4', reservationId: 'res-9', status: 'Closed', plan: 'Cash', salePrice: 2_430_000, discount: 80_000, fees: [{ id: 'fee-3', label: 'Dealer handling', amount: 59_900 }], taxRate: 8.81, downPayment: 0, openedAt: dayOffset(today, -30), closedAt: dayOffset(today, -24), notes: '', delivery: { vehicleReady: true, documentsSigned: true, paymentConfirmed: true, insuranceProvided: true, keysHandedOver: true, completedAt: dayOffset(today, -24), notes: '' } },
    { id: 'deal-3', code: formatCode('deal', 7003), customerId: 'cus-3', vehicleId: v(12), salespersonId: 'sp-2', reservationId: 'res-10', status: 'Closed', plan: 'Financing', salePrice: 3_040_000, discount: 0, fees: [{ id: 'fee-4', label: 'Dealer handling', amount: 59_900 }, { id: 'fee-5', label: 'Title and registration', amount: 34_500 }], taxRate: 8.81, downPayment: 600_000, openedAt: dayOffset(today, -23), closedAt: dayOffset(today, -16), notes: 'Work van for a contracting business.', delivery: { vehicleReady: true, documentsSigned: true, paymentConfirmed: true, insuranceProvided: true, keysHandedOver: true, completedAt: dayOffset(today, -15), notes: '' } },
    { id: 'deal-4', code: formatCode('deal', 7004), customerId: 'cus-11', vehicleId: v(27), salespersonId: 'sp-4', status: 'Closed', plan: 'Cash', salePrice: 4_140_000, discount: 120_000, fees: [{ id: 'fee-6', label: 'Dealer handling', amount: 59_900 }], taxRate: 8.81, downPayment: 0, openedAt: dayOffset(today, -12), closedAt: dayOffset(today, -6), notes: '', delivery: { vehicleReady: true, documentsSigned: true, paymentConfirmed: true, insuranceProvided: true, keysHandedOver: false, notes: 'Collecting on Friday.' } },
    { id: 'deal-5', code: formatCode('deal', 7005), customerId: 'cus-8', vehicleId: v(13), salespersonId: 'sp-2', status: 'Pending Financing', plan: 'Financing', salePrice: 3_890_000, discount: 90_000, fees: [{ id: 'fee-7', label: 'Dealer handling', amount: 59_900 }, { id: 'fee-8', label: 'Title and registration', amount: 34_500 }], taxRate: 8.81, downPayment: 500_000, openedAt: dayOffset(today, -5), notes: 'Customer has a monthly payment target.', tradeIn: { year: 2016, make: 'Ford', model: 'Edge', mileage: 96_400, vin: demoVin(901), allowance: 780_000, payoff: 240_000 } },
    { id: 'deal-6', code: formatCode('deal', 7006), customerId: 'cus-10', vehicleId: v(17), salespersonId: 'sp-2', status: 'Pending Documents', plan: 'Financing', salePrice: 3_820_000, discount: 60_000, fees: [{ id: 'fee-9', label: 'Dealer handling', amount: 59_900 }], taxRate: 8.81, downPayment: 700_000, openedAt: dayOffset(today, -6), notes: 'Repeat customer, trading his old Sierra.', tradeIn: { year: 2018, make: 'GMC', model: 'Sierra 1500', mileage: 78_900, vin: demoVin(902), allowance: 1_450_000, payoff: 0 } },
    { id: 'deal-7', code: formatCode('deal', 7007), customerId: 'cus-9', vehicleId: v(26), salespersonId: 'sp-2', status: 'Ready to Close', plan: 'Cash', salePrice: 4_140_000, discount: 140_000, fees: [{ id: 'fee-10', label: 'Dealer handling', amount: 59_900 }], taxRate: 8.81, downPayment: 0, openedAt: dayOffset(today, -8), notes: '' },
    { id: 'deal-8', code: formatCode('deal', 7008), customerId: 'cus-6', vehicleId: v(6), salespersonId: 'sp-2', status: 'Negotiation', plan: 'Financing', salePrice: 3_680_000, discount: 0, fees: [], taxRate: 8.81, downPayment: 450_000, openedAt: dayOffset(today, -2), notes: 'Trade allowance is the open question.', tradeIn: { year: 2014, make: 'Chevrolet', model: 'Equinox', mileage: 128_300, vin: demoVin(903), allowance: 420_000, payoff: 0 } },
    { id: 'deal-9', code: formatCode('deal', 7009), customerId: 'cus-4', vehicleId: v(22), salespersonId: 'sp-5', status: 'Pending Financing', plan: 'Financing', salePrice: 799_000, discount: 0, fees: [{ id: 'fee-11', label: 'Dealer handling', amount: 39_900 }], taxRate: 8.81, downPayment: 150_000, openedAt: dayOffset(today, -3), notes: 'First-time buyer on a Ninja 650.' },
    { id: 'deal-10', code: formatCode('deal', 7010), customerId: 'cus-14', vehicleId: v(19), salespersonId: 'sp-4', status: 'Draft', plan: 'Cash', salePrice: 4_010_000, discount: 0, fees: [], taxRate: 8.81, downPayment: 0, openedAt: dayOffset(today, -1), notes: 'Fleet enquiry for a Transit. Pricing not agreed.' },
    { id: 'deal-11', code: formatCode('deal', 7011), customerId: 'cus-13', vehicleId: v(28), salespersonId: 'sp-4', status: 'Cancelled', plan: 'Cash', salePrice: 1_690_000, discount: 0, fees: [], taxRate: 8.81, downPayment: 0, openedAt: dayOffset(today, -20), notes: 'Customer withdrew.' },
    { id: 'deal-12', code: formatCode('deal', 7012), customerId: 'cus-12', vehicleId: v(24), salespersonId: 'sp-5', status: 'Closed', plan: 'Cash', salePrice: 830_000, discount: 20_000, fees: [{ id: 'fee-12', label: 'Dealer handling', amount: 39_900 }], taxRate: 8.81, downPayment: 0, openedAt: dayOffset(today, -48), closedAt: dayOffset(today, -44), notes: '', delivery: { vehicleReady: true, documentsSigned: true, paymentConfirmed: true, insuranceProvided: true, keysHandedOver: true, completedAt: dayOffset(today, -44), notes: '' } },
  ];

  const financing: FinancingApplication[] = [
    { id: 'fin-1', code: formatCode('financing', 9001), customerId: 'cus-1', dealId: 'deal-1', vehicleId: v(1), status: 'Completed', amountRequested: 1_900_000, downPayment: 400_000, termMonths: 60, lenderCategory: 'Credit union partner', financeContactId: 'sp-3', submittedAt: dayOffset(today, -35), decisionAt: dayOffset(today, -33), decisionNotes: 'Approved at the requested term.', createdAt: timeOffset(today, -36, 11, 0) },
    { id: 'fin-2', code: formatCode('financing', 9002), customerId: 'cus-3', dealId: 'deal-3', vehicleId: v(12), status: 'Completed', amountRequested: 2_600_000, downPayment: 600_000, termMonths: 72, lenderCategory: 'Bank partner', financeContactId: 'sp-3', submittedAt: dayOffset(today, -21), decisionAt: dayOffset(today, -19), decisionNotes: 'Approved. Proof of business income was requested and provided.', createdAt: timeOffset(today, -22, 14, 30) },
    { id: 'fin-3', code: formatCode('financing', 9003), customerId: 'cus-8', dealId: 'deal-5', vehicleId: v(13), status: 'Under Review', amountRequested: 3_100_000, downPayment: 500_000, termMonths: 72, lenderCategory: 'Bank partner', financeContactId: 'sp-3', submittedAt: dayOffset(today, -3), decisionNotes: 'Lender asked for one more income reference.', createdAt: timeOffset(today, -5, 10, 0) },
    { id: 'fin-4', code: formatCode('financing', 9004), customerId: 'cus-10', dealId: 'deal-6', vehicleId: v(17), status: 'Conditionally Approved', amountRequested: 2_100_000, downPayment: 700_000, termMonths: 60, lenderCategory: 'Credit union partner', financeContactId: 'sp-3', submittedAt: dayOffset(today, -5), decisionAt: dayOffset(today, -2), decisionNotes: 'Conditional on proof of insurance before delivery.', createdAt: timeOffset(today, -6, 9, 45) },
    { id: 'fin-5', code: formatCode('financing', 9005), customerId: 'cus-4', dealId: 'deal-9', vehicleId: v(22), status: 'Submitted', amountRequested: 700_000, downPayment: 150_000, termMonths: 48, lenderCategory: 'Powersports lender', financeContactId: 'sp-3', submittedAt: dayOffset(today, -1), decisionNotes: '', createdAt: timeOffset(today, -3, 15, 20) },
    { id: 'fin-6', code: formatCode('financing', 9006), customerId: 'cus-6', dealId: 'deal-8', vehicleId: v(6), status: 'Documents Needed', amountRequested: 3_230_000, downPayment: 450_000, termMonths: 72, lenderCategory: 'Bank partner', financeContactId: 'sp-3', decisionNotes: 'Waiting on proof of address.', createdAt: timeOffset(today, -2, 13, 10) },
    { id: 'fin-7', code: formatCode('financing', 9007), customerId: 'cus-13', dealId: 'deal-11', vehicleId: v(28), status: 'Withdrawn', amountRequested: 1_400_000, downPayment: 300_000, termMonths: 60, lenderCategory: 'Bank partner', financeContactId: 'sp-3', decisionNotes: 'Customer withdrew before submission.', createdAt: timeOffset(today, -19, 16, 0) },
    { id: 'fin-8', code: formatCode('financing', 9008), customerId: 'cus-16', dealId: 'deal-10', vehicleId: v(19), status: 'Draft', amountRequested: 3_500_000, downPayment: 500_000, termMonths: 72, lenderCategory: 'Commercial lender', financeContactId: 'sp-3', decisionNotes: '', createdAt: timeOffset(today, -1, 12, 0) },
  ];

  const payments: Payment[] = [
    { id: 'pay-1', code: formatCode('payment', 6001), customerId: 'cus-1', kind: 'Reservation Deposit', reservationId: 'res-8', dealId: 'deal-1', amount: 50_000, method: 'Card', receivedAt: dayOffset(today, -40), reference: 'Deposit on RAV4' },
    { id: 'pay-2', code: formatCode('payment', 6002), customerId: 'cus-1', kind: 'Down Payment', dealId: 'deal-1', amount: 350_000, method: 'ACH', receivedAt: dayOffset(today, -31), reference: '' },
    { id: 'pay-3', code: formatCode('payment', 6003), customerId: 'cus-2', kind: 'Reservation Deposit', reservationId: 'res-9', dealId: 'deal-2', amount: 50_000, method: 'Card', receivedAt: dayOffset(today, -33), reference: '' },
    { id: 'pay-4', code: formatCode('payment', 6004), customerId: 'cus-2', kind: 'Balance Payment', dealId: 'deal-2', amount: 2_612_128, method: 'ACH', receivedAt: dayOffset(today, -24), reference: 'Cash purchase, paid in full' },
    { id: 'pay-5', code: formatCode('payment', 6005), customerId: 'cus-3', kind: 'Reservation Deposit', reservationId: 'res-10', dealId: 'deal-3', amount: 100_000, method: 'Card', receivedAt: dayOffset(today, -26), reference: '' },
    { id: 'pay-6', code: formatCode('payment', 6006), customerId: 'cus-3', kind: 'Down Payment', dealId: 'deal-3', amount: 500_000, method: 'Check', receivedAt: dayOffset(today, -17), reference: 'Check 2281' },
    { id: 'pay-7', code: formatCode('payment', 6007), customerId: 'cus-11', kind: 'Balance Payment', dealId: 'deal-4', amount: 4_397_452, method: 'ACH', receivedAt: dayOffset(today, -7), reference: '' },
    { id: 'pay-8', code: formatCode('payment', 6008), customerId: 'cus-4', kind: 'Reservation Deposit', reservationId: 'res-1', dealId: 'deal-9', amount: 50_000, method: 'Card', receivedAt: dayOffset(today, -6), reference: '' },
    { id: 'pay-9', code: formatCode('payment', 6009), customerId: 'cus-5', kind: 'Reservation Deposit', reservationId: 'res-2', amount: 75_000, method: 'Card', receivedAt: dayOffset(today, -4), reference: '' },
    { id: 'pay-10', code: formatCode('payment', 6010), customerId: 'cus-9', kind: 'Reservation Deposit', reservationId: 'res-4', dealId: 'deal-7', amount: 100_000, method: 'Card', receivedAt: dayOffset(today, -9), reference: '' },
    { id: 'pay-11', code: formatCode('payment', 6011), customerId: 'cus-10', kind: 'Down Payment', dealId: 'deal-6', amount: 700_000, method: 'ACH', receivedAt: dayOffset(today, -3), reference: '' },
    { id: 'pay-12', code: formatCode('payment', 6012), customerId: 'cus-12', kind: 'Balance Payment', dealId: 'deal-12', amount: 921_419, method: 'Cash', receivedAt: dayOffset(today, -45), reference: '' },
    { id: 'pay-13', code: formatCode('payment', 6013), customerId: 'cus-8', kind: 'Down Payment', dealId: 'deal-5', amount: 200_000, method: 'Card', receivedAt: dayOffset(today, -4), reference: 'Partial down payment' },
    { id: 'pay-14', code: formatCode('payment', 6014), customerId: 'cus-15', kind: 'Reservation Deposit', reservationId: 'res-7', amount: 50_000, method: 'Card', receivedAt: dayOffset(today, -18), reference: '' },
    { id: 'pay-15', code: formatCode('payment', 6015), customerId: 'cus-15', kind: 'Refund', reservationId: 'res-7', amount: -50_000, method: 'Card', receivedAt: dayOffset(today, -4), reference: 'Reservation cancelled, deposit returned' },
    { id: 'pay-16', code: formatCode('payment', 6016), customerId: 'cus-9', kind: 'Balance Payment', dealId: 'deal-7', amount: 2_000_000, method: 'ACH', receivedAt: dayOffset(today, -2), reference: 'Part payment' },
  ];

  const documentSpecs: [
    type: DocumentRecord['type'],
    status: DocumentRecord['status'],
    customerId: string,
    dealId: string | undefined,
    reservationId: string | undefined,
    label: string,
  ][] = [
    ['Photo ID', 'Reviewed', 'cus-1', 'deal-1', undefined, 'marin-id.pdf'],
    ['Proof of Insurance', 'Received', 'cus-1', 'deal-1', undefined, 'marin-insurance.pdf'],
    ['Deal Summary', 'Signed', 'cus-1', 'deal-1', undefined, 'DEA-7001-summary.pdf'],
    ['Financing Application', 'Signed', 'cus-1', 'deal-1', undefined, 'FIN-9001.pdf'],
    ['Delivery Confirmation', 'Signed', 'cus-1', 'deal-1', undefined, ''],
    ['Photo ID', 'Reviewed', 'cus-2', 'deal-2', undefined, ''],
    ['Proof of Insurance', 'Received', 'cus-2', 'deal-2', undefined, ''],
    ['Deal Summary', 'Signed', 'cus-2', 'deal-2', undefined, ''],
    ['Photo ID', 'Reviewed', 'cus-3', 'deal-3', undefined, ''],
    ['Proof of Insurance', 'Received', 'cus-3', 'deal-3', undefined, ''],
    ['Deal Summary', 'Signed', 'cus-3', 'deal-3', undefined, ''],
    ['Financing Application', 'Signed', 'cus-3', 'deal-3', undefined, ''],
    ['Photo ID', 'Reviewed', 'cus-11', 'deal-4', undefined, ''],
    ['Proof of Insurance', 'Received', 'cus-11', 'deal-4', undefined, ''],
    ['Deal Summary', 'Signed', 'cus-11', 'deal-4', undefined, ''],
    ['Photo ID', 'Received', 'cus-8', 'deal-5', undefined, 'whelan-id.jpg'],
    ['Proof of Address', 'Requested', 'cus-8', 'deal-5', undefined, ''],
    ['Income Reference', 'Requested', 'cus-8', 'deal-5', undefined, ''],
    ['Trade-in Title', 'Missing', 'cus-8', 'deal-5', undefined, ''],
    ['Photo ID', 'Reviewed', 'cus-10', 'deal-6', undefined, ''],
    ['Financing Application', 'Signed', 'cus-10', 'deal-6', undefined, ''],
    ['Proof of Insurance', 'Requested', 'cus-10', 'deal-6', undefined, ''],
    ['Trade-in Title', 'Received', 'cus-10', 'deal-6', undefined, 'sutton-title.pdf'],
    ['Deal Summary', 'Received', 'cus-10', 'deal-6', undefined, ''],
    ['Photo ID', 'Reviewed', 'cus-9', 'deal-7', undefined, ''],
    ['Proof of Insurance', 'Received', 'cus-9', 'deal-7', undefined, ''],
    ['Deal Summary', 'Received', 'cus-9', 'deal-7', undefined, ''],
    ['Reservation Receipt', 'Signed', 'cus-4', undefined, 'res-1', ''],
    ['Reservation Receipt', 'Signed', 'cus-5', undefined, 'res-2', ''],
    ['Reservation Receipt', 'Received', 'cus-9', undefined, 'res-4', ''],
    ['Photo ID', 'Missing', 'cus-6', 'deal-8', undefined, ''],
    ['Proof of Address', 'Requested', 'cus-6', 'deal-8', undefined, ''],
    ['Photo ID', 'Received', 'cus-4', 'deal-9', undefined, ''],
    ['Financing Application', 'Received', 'cus-4', 'deal-9', undefined, ''],
  ];

  const documents: DocumentRecord[] = documentSpecs.map((spec, index) => {
    const [type, status, customerId, dealId, reservationId, fileLabel] = spec;
    const received = ['Received', 'Reviewed', 'Signed'].includes(status);
    return {
      id: `doc-${index + 1}`,
      code: formatCode('document', 8001 + index),
      type,
      status,
      customerId,
      dealId,
      reservationId,
      fileLabel: fileLabel || undefined,
      requestedAt: status === 'Requested' ? dayOffset(today, -3) : undefined,
      receivedAt: received ? dayOffset(today, -(index % 12) - 2) : undefined,
      notes: '',
    };
  });

  const taskSpecs: [
    kind: Task['kind'],
    title: string,
    dueInDays: number,
    done: boolean,
    assignee: string,
    links: Partial<Pick<Task, 'leadId' | 'customerId' | 'vehicleId' | 'dealId' | 'reservationId'>>,
  ][] = [
    ['Call new lead', 'Call Renata Alvarez about the RAV4', 0, false, 'sp-4', { leadId: 'lead-1' }],
    ['Call new lead', 'Call Aurelio Vance about the Frontier', 0, false, 'sp-2', { leadId: 'lead-14' }],
    ['Confirm appointment', 'Confirm Saturday viewing with Dominique Carter', 1, false, 'sp-2', { leadId: 'lead-3' }],
    ['Confirm appointment', 'Confirm the Crosstrek test drive with Tamsin Kelleher', 0, false, 'sp-4', { leadId: 'lead-15' }],
    ['Follow up on reservation', 'RES-5004 expires tomorrow — call Bianca Solomon', 1, false, 'sp-2', { reservationId: 'res-4', customerId: 'cus-9' }],
    ['Follow up on reservation', 'Collect the deposit for RES-5003', 2, false, 'sp-2', { reservationId: 'res-3', customerId: 'cus-7' }],
    ['Follow up on reservation', 'RES-5001 expires in two days', 2, false, 'sp-5', { reservationId: 'res-1', customerId: 'cus-4' }],
    ['Request missing document', 'Request proof of address from Saoirse Whelan', 0, false, 'sp-3', { dealId: 'deal-5', customerId: 'cus-8' }],
    ['Request missing document', 'Request the trade-in title for DEA-7005', 3, false, 'sp-3', { dealId: 'deal-5', customerId: 'cus-8' }],
    ['Request missing document', 'Proof of insurance needed before DEA-7006 delivery', 1, false, 'sp-3', { dealId: 'deal-6', customerId: 'cus-10' }],
    ['Financing status follow-up', 'Chase the lender on FIN-9003', 1, false, 'sp-3', { dealId: 'deal-5', customerId: 'cus-8' }],
    ['Financing status follow-up', 'FIN-9005 submitted — check for a decision', 2, false, 'sp-3', { dealId: 'deal-9', customerId: 'cus-4' }],
    ['Schedule delivery', 'Book the handover for DEA-7004', 1, false, 'sp-4', { dealId: 'deal-4', customerId: 'cus-11' }],
    ['Post-sale follow-up', 'Check in with Caleb Ortiz after the ProMaster delivery', -8, true, 'sp-2', { dealId: 'deal-3', customerId: 'cus-3' }],
    ['Post-sale follow-up', 'Check in with Osvaldo Marin', -22, true, 'sp-2', { dealId: 'deal-1', customerId: 'cus-1' }],
    ['Call new lead', 'Call Wendell Fisk about the RZR', 2, false, 'sp-5', { leadId: 'lead-10' }],
    ['Call new lead', 'Follow up with Marisol Reyes on the MT-07', 1, false, 'sp-5', { leadId: 'lead-7' }],
    ['Follow up on reservation', 'Check whether Idris Bello can complete on the Outback', 2, false, 'sp-4', { customerId: 'cus-5', reservationId: 'res-2' }],
    ['Schedule delivery', 'Confirm collection time for DEA-7007', 2, false, 'sp-2', { dealId: 'deal-7', customerId: 'cus-9' }],
    ['Request missing document', 'Photo ID still missing for DEA-7008', 1, false, 'sp-3', { dealId: 'deal-8', customerId: 'cus-6' }],
    ['Financing status follow-up', 'FIN-9006 is waiting on documents', 3, false, 'sp-3', { dealId: 'deal-8', customerId: 'cus-6' }],
  ];

  const tasks: Task[] = taskSpecs.map((spec, index) => {
    const [kind, title, dueInDays, done, assigneeId, links] = spec;
    return {
      id: `task-${index + 1}`,
      code: formatCode('task', 4001 + index),
      kind,
      title,
      dueAt: dayOffset(today, dueInDays),
      done,
      assigneeId,
      ...links,
      notes: '',
    };
  });

  // Vehicle status is derived from the records above rather than restated, so
  // the seed cannot contradict itself: a sold car is sold because a closed deal
  // says so, and a held car is held because an active reservation says so.
  for (const deal of deals) {
    if (deal.status === 'Closed') {
      const vehicle = vehicles.find((entry) => entry.id === deal.vehicleId);
      if (vehicle) {
        vehicle.status = 'Sold';
        vehicle.soldAt = deal.closedAt;
      }
    }
  }
  for (const deal of deals) {
    if (COMMITTED_DEAL_STATUSES.includes(deal.status)) {
      const vehicle = vehicles.find((entry) => entry.id === deal.vehicleId);
      if (vehicle && vehicle.status === 'In Stock') vehicle.status = 'Pending Sale';
    }
  }
  for (const reservation of reservations) {
    if (reservation.status !== 'Pending' && reservation.status !== 'Confirmed') continue;
    const vehicle = vehicles.find((entry) => entry.id === reservation.vehicleId);
    if (vehicle && vehicle.status === 'In Stock') vehicle.status = 'Reserved';
  }

  // One unit is off the lot for reconditioning, which the inventory filters need.
  const serviceHold = vehicles.find((entry) => entry.id === v(9));
  if (serviceHold && serviceHold.status === 'In Stock') {
    serviceHold.status = 'Service Hold';
    serviceHold.notes = 'In for reconditioning — new tires and a detail.';
  }

  const activity: ActivityEvent[] = [
    { id: 'act-1', kind: 'deal.closed', at: timeOffset(today, -30, 15, 20), subject: { kind: 'deal', id: 'deal-1' }, related: [{ kind: 'vehicle', id: v(1) }, { kind: 'customer', id: 'cus-1' }], actorId: 'sp-2', message: 'DEA-7001 closed. Vehicle marked sold.' },
    { id: 'act-2', kind: 'delivery.completed', at: timeOffset(today, -29, 10, 0), subject: { kind: 'deal', id: 'deal-1' }, related: [{ kind: 'customer', id: 'cus-1' }], actorId: 'sp-2', message: 'DEA-7001 delivered to the customer.' },
    { id: 'act-3', kind: 'deal.closed', at: timeOffset(today, -24, 16, 45), subject: { kind: 'deal', id: 'deal-2' }, related: [{ kind: 'vehicle', id: v(7) }, { kind: 'customer', id: 'cus-2' }], actorId: 'sp-4', message: 'DEA-7002 closed. Vehicle marked sold.' },
    { id: 'act-4', kind: 'deal.closed', at: timeOffset(today, -16, 11, 30), subject: { kind: 'deal', id: 'deal-3' }, related: [{ kind: 'vehicle', id: v(12) }, { kind: 'customer', id: 'cus-3' }], actorId: 'sp-2', message: 'DEA-7003 closed. Vehicle marked sold.' },
    { id: 'act-5', kind: 'reservation.confirmed', at: timeOffset(today, -9, 9, 10), subject: { kind: 'reservation', id: 'res-4' }, related: [{ kind: 'vehicle', id: v(26) }, { kind: 'customer', id: 'cus-9' }], actorId: 'sp-2', message: 'RES-5004 confirmed.' },
    { id: 'act-6', kind: 'deal.closed', at: timeOffset(today, -6, 14, 0), subject: { kind: 'deal', id: 'deal-4' }, related: [{ kind: 'vehicle', id: v(27) }, { kind: 'customer', id: 'cus-11' }], actorId: 'sp-4', message: 'DEA-7004 closed. Vehicle marked sold.' },
    { id: 'act-7', kind: 'reservation.confirmed', at: timeOffset(today, -6, 13, 25), subject: { kind: 'reservation', id: 'res-1' }, related: [{ kind: 'vehicle', id: v(22) }, { kind: 'customer', id: 'cus-4' }], actorId: 'sp-5', message: 'RES-5001 confirmed.' },
    { id: 'act-8', kind: 'financing.status', at: timeOffset(today, -3, 10, 40), subject: { kind: 'financing', id: 'fin-3' }, related: [{ kind: 'deal', id: 'deal-5' }, { kind: 'customer', id: 'cus-8' }], actorId: 'sp-3', message: 'FIN-9003 recorded as Under Review.' },
    { id: 'act-9', kind: 'financing.status', at: timeOffset(today, -2, 15, 5), subject: { kind: 'financing', id: 'fin-4' }, related: [{ kind: 'deal', id: 'deal-6' }, { kind: 'customer', id: 'cus-10' }], actorId: 'sp-3', message: 'FIN-9004 recorded as Conditionally Approved.' },
    { id: 'act-10', kind: 'payment.recorded', at: timeOffset(today, -2, 16, 15), subject: { kind: 'payment', id: 'pay-16' }, related: [{ kind: 'deal', id: 'deal-7' }, { kind: 'customer', id: 'cus-9' }], actorId: 'sp-3', message: 'PAY-6016 recorded — Balance Payment.' },
    { id: 'act-11', kind: 'reservation.created', at: timeOffset(today, -1, 11, 50), subject: { kind: 'reservation', id: 'res-3' }, related: [{ kind: 'vehicle', id: v(10) }, { kind: 'customer', id: 'cus-7' }], actorId: 'sp-2', message: 'RES-5003 created on STK-2011.' },
    { id: 'act-12', kind: 'lead.created', at: timeOffset(today, -1, 8, 30), subject: { kind: 'lead', id: 'lead-1' }, related: [], actorId: 'sp-4', message: 'Lead DL-1001 created for Renata Alvarez.' },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      companyName: 'Summit Auto & Motors',
      legalLine: 'Summit Auto & Motors LLC · Dealer Lic. CO-DL-44120 (demonstration)',
      address: { line1: '4180 Wadsworth Blvd', city: 'Wheat Ridge', state: 'CO', zip: '80033' },
      phone: '(303) 555-0110',
      email: 'sales@summitautomotors.example',
      defaultTaxRate: 8.81,
      reservationHoldDays: 7,
      defaultDeposit: 50_000,
      dealTerms:
        'Figures shown are a demonstration of an operational workflow. This document is not an offer, a contract, or a financing agreement.',
    },
    counters: {
      lead: 1001 + LEAD_SPECS.length,
      customer: 3001 + CUSTOMER_SPECS.length,
      vehicle: 2001 + VEHICLE_SPECS.length,
      reservation: 5011,
      deal: 7013,
      financing: 9009,
      payment: 6017,
      document: 8001 + documentSpecs.length,
      task: 4001 + taskSpecs.length,
    },
    locations: LOCATIONS,
    salespeople: SALESPEOPLE,
    vehicles,
    leads,
    customers,
    reservations,
    deals,
    financing,
    payments,
    documents,
    tasks,
    activity,
  };
}
