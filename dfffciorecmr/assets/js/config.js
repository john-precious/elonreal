
const SUPABASE_URL = "https://eeyevatogludtjcajiad.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_a6nJ0a6vaTq1mWUiOGK-nA_QOs_YIdM";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;

console.log("Supabase connected successfully!");

// STEP 1: Authenticate visitor
async function initializeVisitorAuth() {
    const { data: { session }, error: sessionError } =
        await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (session) {
        console.log("Visitor already authenticated!");
        console.log("Visitor ID:", session.user.id);
        return session.user;
    }

    const { data, error } =
        await supabaseClient.auth.signInAnonymously();

    if (error) throw error;

    console.log("Anonymous visitor authenticated!");
    console.log("Visitor ID:", data.user.id);

    return data.user;
}

// STEP 2: Create or retrieve conversation
async function getOrCreateConversation(user) {
    const { data: existing, error: fetchError } =
        await supabaseClient
            .from("conversations")
            .select("id")
            .eq("visitor_id", user.id)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
        console.log("Existing conversation loaded:", existing.id);
        return existing.id;
    }

    const { data, error } = await supabaseClient
        .from("conversations")
        .insert({
            visitor_id: user.id
        })
        .select("id")
        .single();

    if (error) throw error;

    console.log("New conversation created:", data.id);

    return data.id;
}

// STEP 3: Start chat
async function startChat() {
    try {
        const user = await initializeVisitorAuth();
        window.currentVisitor = user;

        const conversationId =
            await getOrCreateConversation(user);

        window.currentConversationId = conversationId;

        console.log("Chat is ready!");
        console.log("Conversation ID:", conversationId);

    } catch (error) {
        console.error("Chat initialization failed:", error);
    }
}

window.chatReady = startChat();

// STEP 4: Send visitor messages
async function sendMessage(message) {

    if (!message || !message.trim()) {
        console.warn("Message cannot be empty.");
        return;
    }

    if (!window.currentConversationId || !window.currentVisitor) {
        console.error("Chat is not ready yet.");
        return;
    }

    const { error } = await supabaseClient
        .from("messages")
        .insert({
            conversation_id: window.currentConversationId,
            sender_id: window.currentVisitor.id,
            sender_role: "visitor",
            body: message.trim()
        });

    if (error) {
        console.error("Message sending failed:", error.message);
        return;
    }

    console.log("Message sent successfully!");
}

window.sendMessage = sendMessage;
