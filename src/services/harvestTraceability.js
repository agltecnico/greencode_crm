import { supabase } from '../config/supabase';

export const linkHarvestToDeliveredOrders = async (harvestId, allocations) => {
  const normalizedAllocations = (allocations || [])
    .map(allocation => ({
      movementId: allocation.movementId,
      quantity: Number(allocation.quantity || 0)
    }))
    .filter(allocation => allocation.movementId && allocation.quantity > 0);

  const { data, error } = await supabase.rpc('link_harvest_to_delivered_orders', {
    p_harvest_id: harvestId,
    p_allocations: normalizedAllocations
  });

  if (error) throw error;
  return data;
};
