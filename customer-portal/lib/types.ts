export interface Place {
  id: string;
  uuid: string;
  public_id: string;
  name: string;
  street1: string;
  street2: string | null;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
}

export interface Payload {
  id: string;
  uuid: string;
  public_id: string;
  pickup: Place | null;
  dropoff: Place | null;
  waypoints: Place[];
  entities: Entity[];
}

export interface Entity {
  id: string;
  uuid: string;
  public_id: string;
  name: string;
  type: string;
  meta: Record<string, unknown>;
}

export interface TrackingStatus {
  id: string;
  uuid: string;
  status: string;
  details: string;
  code: string;
  created_at: string;
}

export interface Order {
  id: string;
  uuid: string;
  public_id: string;
  internal_id: string | null;
  status: string;
  type: string;
  notes: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  payload: Payload | null;
  tracking_number: {
    public_id: string;
    tracking_number: string;
  } | null;
  tracking_statuses: TrackingStatus[];
  customer: {
    id: string;
    public_id: string;
    name: string;
  } | null;
  driver_assigned: {
    id: string;
    public_id: string;
    name: string;
    phone: string;
  } | null;
}

export interface OrdersResponse {
  orders: Order[];
  meta?: {
    total: number;
    current_page: number;
    last_page: number;
  };
}

export interface OrderResponse {
  order: Order;
}

export interface PlacesResponse {
  places: Place[];
}
