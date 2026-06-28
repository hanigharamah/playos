/**
 * Drop-in replacement for @workspace/api-client-react.
 * All hook names and return shapes are identical — pages only need to change their import path.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type {
  AuthUser,
  GameSummary,
  GameDetail,
  BookSpotBody,
  BookingWithPlayer as _BookingWithPlayer,
  MyBookingsResponse,
  DashboardGamesResponse,
  PayoutsResponse,
  PayoutDetailsBody,
  Game,
  CreateGameBody,
  UpdateGameBody,
  Pitch,
  CreatePitchBody,
  HostApplicationBody,
  CheckoutResponse,
  PaymentVerifyResponse,
  CancelBookingResponse,
  Booking,
  GameManagement as _GameManagement,
} from "@workspace/api-client-react";

// Extend BookingWithPlayer with check-in fields the manage pages use
export type BookingWithPlayer = _BookingWithPlayer & {
  checkedIn: boolean;
  checkedInAt: Date | null;
};

// Re-export GameManagement with the extended booking type
export type GameManagement = Omit<_GameManagement, "bookings"> & {
  bookings: BookingWithPlayer[];
};

// Re-export all other types
export type {
  AuthUser, GameSummary, GameDetail, BookSpotBody,
  MyBookingsResponse, DashboardGamesResponse, PayoutsResponse, PayoutDetailsBody,
  Game, CreateGameBody, UpdateGameBody, Pitch, CreatePitchBody, HostApplicationBody,
  CheckoutResponse, PaymentVerifyResponse, CancelBookingResponse, Booking,
};

// ─── No-ops for legacy compat (not needed with Supabase) ──────────────────
export function setBaseUrl(_url: string | null): void {}
export function setAuthTokenGetter(_getter: unknown): void {}

// ─── Helpers ──────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("05")) return `+966${digits.slice(1)}`;
  return `+966${digits}`;
}

function mapGame(g: Record<string, any>): Game {
  return {
    id: g.id,
    organiserId: g.organiser_id,
    title: g.title,
    pitchName: g.pitch_name,
    locationText: g.location_text ?? null,
    kickoffTime: g.kickoff_time,
    price: Number(g.price),
    capacity: g.capacity,
    status: g.status,
    autoCancelHours: g.auto_cancel_hours,
    durationMinutes: g.duration_minutes,
    isPublic: g.is_public,
    mapsUrl: g.maps_url ?? null,
    createdAt: g.created_at,
  };
}

function mapBookingWithPlayer(b: Record<string, any>): BookingWithPlayer {
  return {
    id: b.id,
    gameId: b.game_id,
    userId: b.user_id,
    team: b.team,
    slotIndex: b.slot_index,
    paymentStatus: b.payment_status,
    paymentId: b.payment_id ?? null,
    bookedAt: b.booked_at,
    playerName: (b.users as any)?.name ?? "Unknown",
    playerPhone: (b.users as any)?.phone ?? null,
    checkedIn: b.checked_in,
    checkedInAt: b.checked_in_at ? new Date(b.checked_in_at) : null,
  } as BookingWithPlayer;
}

// ─── Query key helpers ────────────────────────────────────────────────────

export const getGetMeQueryKey = () => ["/api/auth/me"] as const;
export const getGetGameQueryKey = (id: string) => [`/api/games/${id}`] as const;
export const getGetGameManagementQueryKey = (id: string) => [`/api/games/${id}/manage`] as const;
export const getListGamesQueryKey = (params?: { city?: string }) => ["/api/games", params] as const;
export const getGetDashboardGamesQueryKey = () => ["/api/dashboard"] as const;
export const getGetDashboardPayoutsQueryKey = () => ["/api/payouts"] as const;
export const getGetMyBookingsQueryKey = () => ["/api/my-bookings"] as const;
export const getVerifyPaymentQueryKey = (params: { session_id: string; gameId: string }) =>
  ["/api/payment/verify", params] as const;

// ─── Auth ─────────────────────────────────────────────────────────────────

export function useGetMe(options?: { query?: { retry?: boolean } }) {
  return useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: async (): Promise<AuthUser | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
      if (!data) return null;
      return {
        id: data.id,
        email: data.email,
        phone: data.phone,
        name: data.name,
        role: data.role,
        createdAt: data.created_at,
      };
    },
    retry: options?.query?.retry ?? false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: { email: string; password: string } }): Promise<AuthUser> => {
      const { data: auth, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw { data: { error: error.message } };

      const { data: profile } = await supabase
        .from("users").select("*").eq("id", auth.user.id).single();
      if (!profile) throw { data: { error: "Profile not found" } };

      const user: AuthUser = {
        id: profile.id, email: profile.email, phone: profile.phone,
        name: profile.name, role: profile.role, createdAt: profile.created_at,
      };
      queryClient.setQueryData(getGetMeQueryKey(), user);
      return user;
    },
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
    }: { data: { email: string; password: string; phone: string; name: string } }): Promise<AuthUser> => {
      const { data: auth, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { name: data.name, role: "player" } },
      });
      if (error) throw { data: { error: error.message } };
      if (!auth.user) throw { data: { error: "Signup failed" } };

      // Trigger creates the profile; update phone separately
      await supabase.from("users")
        .update({ phone: normalizePhone(data.phone) })
        .eq("id", auth.user.id);

      const { data: profile } = await supabase
        .from("users").select("*").eq("id", auth.user.id).single();
      if (!profile) throw { data: { error: "Profile creation failed" } };

      const user: AuthUser = {
        id: profile.id, email: profile.email, phone: profile.phone,
        name: profile.name, role: profile.role, createdAt: profile.created_at,
      };
      queryClient.setQueryData(getGetMeQueryKey(), user);
      return user;
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await supabase.auth.signOut();
      queryClient.clear();
    },
  });
}

export function useHostLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: { phone: string; password: string } }): Promise<AuthUser> => {
      const { data: email, error: rpcErr } = await supabase.rpc("get_user_email_by_phone", {
        user_phone: normalizePhone(data.phone),
      });
      if (rpcErr || !email) throw { data: { error: "Phone number not found" } };

      const { data: auth, error } = await supabase.auth.signInWithPassword({
        email: email as string,
        password: data.password,
      });
      if (error) throw { data: { error: error.message } };

      const { data: profile } = await supabase
        .from("users").select("*").eq("id", auth.user.id).single();
      if (!profile) throw { data: { error: "User not found" } };
      if (profile.role !== "host" && profile.role !== "admin") {
        await supabase.auth.signOut();
        throw { data: { error: "Host account required" } };
      }

      const user: AuthUser = {
        id: profile.id, email: profile.email, phone: profile.phone,
        name: profile.name, role: profile.role, createdAt: profile.created_at,
      };
      queryClient.setQueryData(getGetMeQueryKey(), user);
      return user;
    },
  });
}

// ─── Games ────────────────────────────────────────────────────────────────

export function useGetFeaturedGames() {
  return useQuery({
    queryKey: ["/api/games/featured"],
    queryFn: async (): Promise<GameSummary[]> => {
      const { data, error } = await supabase
        .from("games")
        .select("*, bookings(id, payment_status)")
        .eq("is_public", true)
        .eq("status", "open")
        .gte("kickoff_time", new Date().toISOString())
        .order("kickoff_time", { ascending: true })
        .limit(6);
      if (error) throw error;
      return mapGameSummaryList(data ?? []);
    },
  });
}

export function useListGames(params?: { city?: string }) {
  return useQuery({
    queryKey: getListGamesQueryKey(params),
    queryFn: async (): Promise<GameSummary[]> => {
      const { data, error } = await supabase
        .from("games")
        .select("*, bookings(id, payment_status)")
        .eq("is_public", true)
        .neq("status", "cancelled")
        .gte("kickoff_time", new Date().toISOString())
        .order("kickoff_time", { ascending: true });
      if (error) throw error;
      return mapGameSummaryList(data ?? []);
    },
  });
}

function mapGameSummaryList(rows: any[]): GameSummary[] {
  return rows.map((g) => ({
    id: g.id,
    title: g.title,
    pitchName: g.pitch_name,
    locationText: g.location_text ?? null,
    kickoffTime: g.kickoff_time,
    price: Number(g.price),
    capacity: g.capacity,
    status: g.status,
    bookedCount: (g.bookings as any[]).filter((b) => b.payment_status === "paid").length,
    durationMinutes: g.duration_minutes,
    isPublic: g.is_public,
    mapsUrl: g.maps_url ?? null,
    latitude: g.latitude ?? null,
    longitude: g.longitude ?? null,
  }));
}

export function useGetGame(
  id: string,
  options?: { query?: { enabled?: boolean; queryKey?: readonly unknown[] } },
) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetGameQueryKey(id),
    queryFn: async (): Promise<GameDetail> => {
      const { data: game, error } = await supabase
        .from("games")
        .select("*, bookings(*, users(name, phone))")
        .eq("id", id)
        .single();
      if (error) throw error;

      const bookings = (game.bookings as any[]).map(mapBookingWithPlayer);
      return {
        ...mapGame(game),
        bookings,
        bookedCount: bookings.filter((b) => b.paymentStatus === "paid").length,
      };
    },
    enabled: options?.query?.enabled ?? !!id,
  });
}

export function useGetGameManagement(
  id: string,
  options?: { query?: { enabled?: boolean; queryKey?: readonly unknown[] } },
) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetGameManagementQueryKey(id),
    queryFn: async (): Promise<GameManagement> => {
      const { data: game, error } = await supabase
        .from("games")
        .select("*, bookings(*, users(name, phone))")
        .eq("id", id)
        .single();
      if (error) throw error;

      const bookings = (game.bookings as any[]).map(mapBookingWithPlayer);
      const paid = bookings.filter((b) => b.paymentStatus === "paid");
      const PLATFORM_FEE = 0.05;

      return {
        game: mapGame(game),
        bookings,
        bookedCount: paid.length,
        netPayout: paid.length * Number(game.price) * (1 - PLATFORM_FEE),
        shareUrl: `${window.location.origin}/game/${id}`,
      };
    },
    enabled: options?.query?.enabled ?? !!id,
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: CreateGameBody }): Promise<Game> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { data: { error: "Not authenticated" } };

      const { data: game, error } = await supabase
        .from("games")
        .insert({
          id: uid(),
          organiser_id: user.id,
          title: data.title,
          pitch_name: data.pitchName,
          location_text: data.locationText ?? null,
          kickoff_time: data.kickoffTime,
          price: data.price,
          capacity: data.capacity,
          auto_cancel_hours: data.autoCancelHours ?? 4,
          duration_minutes: data.durationMinutes ?? 60,
          is_public: data.isPublic ?? true,
          maps_url: data.mapsUrl ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: getGetDashboardGamesQueryKey() });
      return mapGame(game);
    },
  });
}

export function useUpdateGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateGameBody }): Promise<Game> => {
      const patch: Record<string, unknown> = {};
      if (data.title !== undefined) patch.title = data.title;
      if (data.pitchName !== undefined) patch.pitch_name = data.pitchName;
      if (data.locationText !== undefined) patch.location_text = data.locationText;
      if (data.kickoffTime !== undefined) patch.kickoff_time = data.kickoffTime;
      if (data.price !== undefined) patch.price = data.price;
      if (data.capacity !== undefined) patch.capacity = data.capacity;
      if (data.isPublic !== undefined) patch.is_public = data.isPublic;
      if (data.status !== undefined) patch.status = data.status;
      if (data.mapsUrl !== undefined) patch.maps_url = data.mapsUrl;

      const { data: game, error } = await supabase
        .from("games").update(patch).eq("id", id).select().single();
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetGameManagementQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetDashboardGamesQueryKey() });
      return mapGame(game);
    },
  });
}

export function useDeleteGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }): Promise<void> => {
      const { error } = await supabase.from("games").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: getGetDashboardGamesQueryKey() });
    },
  });
}

// ─── Bookings ─────────────────────────────────────────────────────────────

export function useBookSpot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BookSpotBody }): Promise<CheckoutResponse> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { data: { error: "Not authenticated" } };

      const { data: game, error: gameErr } = await supabase
        .from("games")
        .select("*, bookings(team, slot_index, payment_status, user_id)")
        .eq("id", id)
        .single();
      if (gameErr || !game) throw { data: { error: "Game not found" } };
      if (game.status === "cancelled") throw { data: { error: "Game is cancelled" } };
      if (game.status === "full") throw { data: { error: "Game is full" } };

      const paidBookings = (game.bookings as any[]).filter((b) => b.payment_status === "paid");

      if (paidBookings.some((b) => b.user_id === user.id)) {
        throw { data: { error: "You already have a spot in this game" } };
      }

      // Assign slot — same logic as the old Express route
      const slotsPerTeam = game.capacity / 2;
      let assignedTeam = data.team;
      let assignedSlot = data.slotIndex;

      const slotTaken = paidBookings.some(
        (b) => b.team === assignedTeam && b.slot_index === assignedSlot,
      );
      if (slotTaken) {
        const used = new Set(paidBookings.filter((b) => b.team === assignedTeam).map((b) => b.slot_index));
        let found = false;
        for (let s = 0; s < slotsPerTeam; s++) {
          if (!used.has(s)) { assignedSlot = s; found = true; break; }
        }
        if (!found) {
          const other = assignedTeam === 1 ? 2 : 1;
          const otherUsed = new Set(paidBookings.filter((b) => b.team === other).map((b) => b.slot_index));
          for (let s = 0; s < slotsPerTeam; s++) {
            if (!otherUsed.has(s)) { assignedTeam = other; assignedSlot = s; found = true; break; }
          }
          if (!found) throw { data: { error: "No spots available" } };
        }
      }

      const bookingId = uid();
      const { error: insErr } = await supabase.from("bookings").insert({
        id: bookingId,
        game_id: id,
        user_id: user.id,
        team: assignedTeam,
        slot_index: assignedSlot,
        payment_status: "pending",
      });
      if (insErr) throw insErr;

      queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });

      // Return a URL pointing to the STC Pay / Cash checkout page
      return {
        checkoutUrl: `/payment/checkout?bookingId=${bookingId}&gameId=${id}`,
        sessionId: bookingId,
      };
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }): Promise<CancelBookingResponse> => {
      const { data: booking } = await supabase
        .from("bookings")
        .select("game_id, user_id, games(kickoff_time)")
        .eq("id", id)
        .single();

      // Free the spot regardless of refund outcome.
      const { error } = await supabase
        .from("bookings").update({ payment_status: "refunded" }).eq("id", id);
      if (error) throw error;

      // Determine outcome by time-to-kickoff:
      //   > 12h  → full refund
      //   6–12h  → 1 credit token
      //   < 6h   → nothing
      const kickoff = (booking?.games as any)?.kickoff_time;
      const hoursUntil = kickoff
        ? (new Date(kickoff).getTime() - Date.now()) / 3_600_000
        : 0;

      let tier: "full" | "credit" | "none" = "none";
      let message = "Booking cancelled. No refund applies this close to kickoff.";

      if (hoursUntil > 12) {
        tier = "full";
        message = "Booking cancelled. You'll receive a full refund.";
      } else if (hoursUntil >= 6) {
        tier = "credit";
        // Award 1 credit token (read-modify-write; fine for single-operator scale).
        const uid = booking?.user_id;
        if (uid) {
          const { data: u } = await supabase.from("users").select("credits").eq("id", uid).single();
          await supabase.from("users").update({ credits: (u?.credits ?? 0) + 1 }).eq("id", uid);
          queryClient.invalidateQueries({ queryKey: getMyCreditsQueryKey() });
        }
        message = "Booking cancelled. 1 credit token added for your next match.";
      }

      if (booking?.game_id) {
        // Reopen game if it was marked full
        await supabase.from("games")
          .update({ status: "open" })
          .eq("id", booking.game_id)
          .eq("status", "full");
        queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(booking.game_id) });
      }
      queryClient.invalidateQueries({ queryKey: getGetMyBookingsQueryKey() });

      return { success: true, refundTier: tier as any, refundAmount: 0, message };
    },
  });
}

// ─── Credit tokens ──────────────────────────────────────────────────────────

export const getMyCreditsQueryKey = () => ["/my-credits"] as const;

export function useGetMyCredits() {
  return useQuery({
    queryKey: getMyCreditsQueryKey(),
    queryFn: async (): Promise<number> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { data } = await supabase.from("users").select("credits").eq("id", user.id).single();
      return data?.credits ?? 0;
    },
  });
}

/** Redeem 1 credit token to pay for a booking (marks it paid, decrements credits). */
export function useRedeemCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, gameId }: { bookingId: string; gameId: string }): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { data: { error: "Not authenticated" } };

      const { data: u } = await supabase.from("users").select("credits").eq("id", user.id).single();
      if (!u || (u.credits ?? 0) < 1) throw { data: { error: "No credits available" } };

      const { error } = await supabase
        .from("bookings")
        .update({ payment_status: "paid", payment_method: "credit", payment_id: `credit_${bookingId}` })
        .eq("id", bookingId);
      if (error) throw error;

      await supabase.from("users").update({ credits: (u.credits ?? 0) - 1 }).eq("id", user.id);

      // Mark game full if at capacity.
      const { data: game } = await supabase
        .from("games").select("capacity, bookings(id, payment_status)").eq("id", gameId).single();
      if (game) {
        const paidCount = (game.bookings as any[]).filter((b) => b.payment_status === "paid").length;
        if (paidCount >= game.capacity) {
          await supabase.from("games").update({ status: "full" }).eq("id", gameId);
        }
      }

      queryClient.invalidateQueries({ queryKey: getMyCreditsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) });
    },
  });
}

export function useGetMyBookings() {
  return useQuery({
    queryKey: getGetMyBookingsQueryKey(),
    queryFn: async (): Promise<MyBookingsResponse> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { upcoming: [], past: [] };

      const { data, error } = await supabase
        .from("bookings")
        .select("*, games(id, title, pitch_name, kickoff_time, price, capacity, status)")
        .eq("user_id", user.id)
        .eq("payment_status", "paid")
        .order("booked_at", { ascending: false });
      if (error) throw error;

      const now = new Date();
      const upcoming: any[] = [];
      const past: any[] = [];

      for (const b of data ?? []) {
        const g = b.games as any;
        const item = {
          id: b.id, gameId: b.game_id, team: b.team, slotIndex: b.slot_index,
          paymentStatus: b.payment_status, bookedAt: b.booked_at,
          game: {
            id: g.id, title: g.title, pitchName: g.pitch_name,
            kickoffTime: g.kickoff_time, price: Number(g.price),
            capacity: g.capacity, status: g.status, bookedCount: 0,
          },
        };
        (new Date(g.kickoff_time) > now ? upcoming : past).push(item);
      }

      return { upcoming, past };
    },
  });
}

export function useVerifyPayment(
  params: { session_id: string; gameId: string },
  options?: { query?: { enabled?: boolean; queryKey?: readonly unknown[]; retry?: number } },
) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getVerifyPaymentQueryKey(params),
    queryFn: async (): Promise<PaymentVerifyResponse> => {
      // session_id is the bookingId in the mock flow
      const { data: booking, error } = await supabase
        .from("bookings").select("*").eq("id", params.session_id).single();
      if (error || !booking) return { status: "not_found", gameId: params.gameId };

      const b: Booking = {
        id: booking.id, gameId: booking.game_id, userId: booking.user_id,
        team: booking.team, slotIndex: booking.slot_index,
        paymentStatus: booking.payment_status, paymentId: booking.payment_id ?? null,
        bookedAt: booking.booked_at,
      };
      return {
        status: booking.payment_status,
        booking: booking.payment_status === "paid" ? b : undefined,
        gameId: params.gameId,
      };
    },
    enabled: options?.query?.enabled ?? !!(params.session_id && params.gameId),
    retry: options?.query?.retry ?? 0,
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────

export function useGetDashboardGames() {
  return useQuery({
    queryKey: getGetDashboardGamesQueryKey(),
    queryFn: async (): Promise<DashboardGamesResponse> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { data: { error: "Not authenticated" } };

      const { data, error } = await supabase
        .from("games")
        .select("*, bookings(id, payment_status)")
        .eq("organiser_id", user.id)
        .order("kickoff_time", { ascending: false });
      if (error) throw error;

      const now = new Date();
      const upcoming: any[] = [];
      const past: any[] = [];

      for (const g of data ?? []) {
        const bookedCount = (g.bookings as any[]).filter((b) => b.payment_status === "paid").length;
        const item = {
          id: g.id, title: g.title, pitchName: g.pitch_name,
          kickoffTime: g.kickoff_time, price: Number(g.price),
          capacity: g.capacity, status: g.status, bookedCount,
          isPublic: g.is_public, durationMinutes: g.duration_minutes,
        };
        (new Date(g.kickoff_time) > now ? upcoming : past).push(item);
      }

      return { upcoming, past, totalUpcoming: upcoming.length, totalPast: past.length };
    },
  });
}

export function useGetDashboardPayouts() {
  return useQuery({
    queryKey: getGetDashboardPayoutsQueryKey(),
    queryFn: async (): Promise<PayoutsResponse> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { data: { error: "Not authenticated" } };

      const [{ data: games }, { data: payoutDetails }] = await Promise.all([
        supabase
          .from("games")
          .select("*, bookings(id, payment_status, booked_at)")
          .eq("organiser_id", user.id),
        supabase
          .from("host_payout_details")
          .select("*")
          .eq("organiser_id", user.id)
          .single(),
      ]);

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const nextPayout = new Date(weekEnd);
      nextPayout.setDate(weekEnd.getDate() + 3);

      const upcoming: any[] = [];
      let allTimeGross = 0;
      let weeklyPaidCount = 0;
      let weeklyRevenue = 0;
      const PLATFORM_FEE = 0.05;

      for (const g of games ?? []) {
        const paid = (g.bookings as any[]).filter((b) => b.payment_status === "paid");
        allTimeGross += paid.length * Number(g.price);

        const weeklyPaid = paid.filter((b) => {
          const d = new Date(b.booked_at);
          return d >= weekStart && d <= weekEnd;
        });
        weeklyPaidCount += weeklyPaid.length;
        weeklyRevenue += weeklyPaid.length * Number(g.price);

        if (new Date(g.kickoff_time) > now) {
          upcoming.push({
            id: g.id, title: g.title, pitchName: g.pitch_name,
            kickoffTime: g.kickoff_time, price: Number(g.price),
            capacity: g.capacity, status: g.status, bookedCount: paid.length,
            isPublic: g.is_public, durationMinutes: g.duration_minutes,
          });
        }
      }

      return {
        weekly: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          paidPlayerCount: weeklyPaidCount,
          netPayout: weeklyRevenue * (1 - PLATFORM_FEE),
          nextPayoutDate: nextPayout.toISOString(),
        },
        allTimeGross,
        upcomingGames: upcoming,
        payoutDetails: payoutDetails
          ? {
              organiserId: payoutDetails.organiser_id,
              accountHolder: payoutDetails.account_holder,
              iban: payoutDetails.iban,
              bankName: payoutDetails.bank_name ?? null,
              swift: payoutDetails.swift ?? null,
              updatedAt: payoutDetails.updated_at,
            }
          : undefined,
      };
    },
  });
}

export function useSavePayoutDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: PayoutDetailsBody }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { data: { error: "Not authenticated" } };

      const { error } = await supabase.from("host_payout_details").upsert({
        organiser_id: user.id,
        account_holder: data.accountHolder,
        iban: data.iban,
        bank_name: data.bankName ?? null,
        swift: data.swift ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: getGetDashboardPayoutsQueryKey() });
    },
  });
}

// ─── App settings (global, operator-controlled) ───────────────────────────

export interface AppSettings {
  bookingFee: number;
  whatsappUrl: string;
  stcpayNumber: string;
  stcpayLink: string;
  guidelines: string;
}

import { DEFAULT_SETTINGS } from "./config";

export const getSettingsQueryKey = () => ["/app-settings"] as const;

function mapSettings(row: Record<string, any> | null): AppSettings {
  return {
    bookingFee: row?.booking_fee != null ? Number(row.booking_fee) : DEFAULT_SETTINGS.bookingFee,
    whatsappUrl: row?.whatsapp_url ?? DEFAULT_SETTINGS.whatsappUrl,
    stcpayNumber: row?.stcpay_number ?? DEFAULT_SETTINGS.stcpayNumber,
    stcpayLink: row?.stcpay_link ?? DEFAULT_SETTINGS.stcpayLink,
    guidelines: row?.guidelines ?? DEFAULT_SETTINGS.guidelines,
  };
}

export function useGetSettings() {
  return useQuery({
    queryKey: getSettingsQueryKey(),
    queryFn: async (): Promise<AppSettings> => {
      // Fall back to defaults if the table is missing or unreadable so the
      // public site never breaks on a settings error.
      try {
        const { data } = await supabase
          .from("app_settings").select("*").eq("id", 1).single();
        return mapSettings(data);
      } catch {
        return mapSettings(null);
      }
    },
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Partial<AppSettings> }): Promise<void> => {
      const patch: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
      if (data.bookingFee !== undefined) patch.booking_fee = data.bookingFee;
      if (data.whatsappUrl !== undefined) patch.whatsapp_url = data.whatsappUrl;
      if (data.stcpayNumber !== undefined) patch.stcpay_number = data.stcpayNumber;
      if (data.stcpayLink !== undefined) patch.stcpay_link = data.stcpayLink;
      if (data.guidelines !== undefined) patch.guidelines = data.guidelines;

      const { error } = await supabase.from("app_settings").upsert(patch);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: getSettingsQueryKey() });
    },
  });
}

/** Operator action: confirm a booking as paid (STC Pay received or cash). */
export function useMarkBookingPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      gameId,
      method,
    }: { id: string; gameId: string; method?: "stcpay" | "cash" }): Promise<void> => {
      const patch: Record<string, unknown> = { payment_status: "paid", payment_id: `manual_${id}` };
      if (method) patch.payment_method = method;
      const { error } = await supabase.from("bookings").update(patch).eq("id", id);
      if (error) throw error;

      // Mark the game full if it has reached capacity.
      const { data: game } = await supabase
        .from("games").select("capacity, bookings(id, payment_status)").eq("id", gameId).single();
      if (game) {
        const paidCount = (game.bookings as any[]).filter((b) => b.payment_status === "paid").length;
        if (paidCount >= game.capacity) {
          await supabase.from("games").update({ status: "full" }).eq("id", gameId);
        }
      }

      queryClient.invalidateQueries({ queryKey: getGetGameManagementQueryKey(gameId) });
      queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) });
      queryClient.invalidateQueries({ queryKey: getGetDashboardGamesQueryKey() });
    },
  });
}

// ─── Pitches ──────────────────────────────────────────────────────────────

export function useListPitches() {
  return useQuery({
    queryKey: ["/api/pitches"],
    queryFn: async (): Promise<Pitch[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("pitches").select("*").eq("organiser_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((p) => ({
        id: p.id, organiserId: p.organiser_id,
        name: p.name, mapsUrl: p.maps_url ?? null, createdAt: p.created_at,
      }));
    },
  });
}

export function useCreatePitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: CreatePitchBody }): Promise<Pitch> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw { data: { error: "Not authenticated" } };

      const { data: pitch, error } = await supabase
        .from("pitches")
        .insert({ id: uid(), organiser_id: user.id, name: data.name, maps_url: data.mapsUrl ?? null })
        .select().single();
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["/api/pitches"] });
      return {
        id: pitch.id, organiserId: pitch.organiser_id,
        name: pitch.name, mapsUrl: pitch.maps_url ?? null, createdAt: pitch.created_at,
      };
    },
  });
}

// ─── Host Applications ────────────────────────────────────────────────────

export function useApplyAsHost() {
  return useMutation({
    mutationFn: async ({ data }: { data: HostApplicationBody }): Promise<{ success: boolean }> => {
      const { error } = await supabase.from("host_applications").insert({
        id: uid(),
        name: data.name,
        pitch_name: data.pitchName,
        phone: data.phone,
        city: data.city,
      });
      if (error) throw error;
      return { success: true };
    },
  });
}

// ─── Check-in (Supabase version of the /api/checkin/:pitchId endpoint) ────

export async function performCheckIn(
  pitchId: string,
  gameId?: string,
): Promise<
  | { status: "checked_in"; title: string; team: number; pitchName: string; checkedInAt: string; minutesLate: number | null }
  | { status: "already_checked_in"; title: string; team: number; pitchName: string; checkedInAt: string }
  | { status: "multiple_matches"; matches: { bookingId: string; gameId: string; title: string; kickoffTime: string; team: number; pitchName: string }[] }
  | { status: "no_match"; pitchName: string | null }
  | { status: "outside_window"; opensAt: string; title: string; pitchName: string }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Resolve pitch name from ID
  const { data: pitch } = await supabase
    .from("pitches").select("name").eq("id", pitchId).single();
  const pitchName = pitch?.name ?? null;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 90 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);

  let gameQuery = supabase
    .from("games")
    .select("id, title, pitch_name, kickoff_time, duration_minutes, capacity")
    .neq("status", "cancelled")
    .gte("kickoff_time", windowStart.toISOString())
    .lte("kickoff_time", windowEnd.toISOString());

  if (pitchName) {
    gameQuery = gameQuery.eq("pitch_name", pitchName);
  }
  if (gameId) {
    gameQuery = gameQuery.eq("id", gameId);
  }

  const { data: games } = await gameQuery;
  if (!games?.length) return { status: "no_match", pitchName };

  const gameIds = games.map((g) => g.id);
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, game_id, team, checked_in, checked_in_at")
    .eq("user_id", user.id)
    .eq("payment_status", "paid")
    .in("game_id", gameIds);

  if (!bookings?.length) return { status: "no_match", pitchName };

  if (bookings.length > 1 && !gameId) {
    return {
      status: "multiple_matches",
      matches: bookings.map((b) => {
        const g = games.find((g) => g.id === b.game_id)!;
        return { bookingId: b.id, gameId: b.game_id, title: g.title, kickoffTime: g.kickoff_time, team: b.team, pitchName: g.pitch_name };
      }),
    };
  }

  const booking = bookings[0];
  const game = games.find((g) => g.id === booking.game_id)!;

  if (booking.checked_in) {
    return { status: "already_checked_in", title: game.title, team: booking.team, pitchName: game.pitch_name, checkedInAt: booking.checked_in_at };
  }

  const kickoff = new Date(game.kickoff_time);
  const checkInOpens = new Date(kickoff.getTime() - 15 * 60 * 1000);
  if (now < checkInOpens) {
    return { status: "outside_window", opensAt: checkInOpens.toISOString(), title: game.title, pitchName: game.pitch_name };
  }

  const checkedInAt = now.toISOString();
  await supabase
    .from("bookings")
    .update({ checked_in: true, checked_in_at: checkedInAt })
    .eq("id", booking.id);

  const minutesLate = Math.max(0, Math.floor((now.getTime() - kickoff.getTime()) / 60000));
  return {
    status: "checked_in",
    title: game.title,
    team: booking.team,
    pitchName: game.pitch_name,
    checkedInAt,
    minutesLate: minutesLate > 0 ? minutesLate : null,
  };
}
