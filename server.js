const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = false; // Always use production mode for real-time server
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize Socket.IO with basic setup but proper room management
  try {
    const { Server: SocketIOServer } = require("socket.io");
    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    // Enhanced connection handling for proper room management
    io.on("connection", (socket) => {
      console.log("👤 User connected:", socket.id);

      // Join development company room for all users in dev mode
      socket.join("company:dev-company");
      console.log(`✅ User ${socket.id} joined dev-company room`);

      // Handle conversation room joining
      socket.on("join:conversation", (conversationId) => {
        socket.join(`conversation:${conversationId}`);
        console.log(
          `✅ User ${socket.id} joined conversation:${conversationId}`
        );
        socket.emit("joined:conversation", { conversationId });
      });

      socket.on("leave:conversation", (conversationId) => {
        socket.leave(`conversation:${conversationId}`);
        socket.emit("left:conversation", { conversationId });
      });

      // Handle conversation view updates (real-time communication between ConversationView and ConversationsList)
      socket.on("conversation:view-update", (data) => {
        console.log(
          `📡 User ${socket.id} emitted conversation:view-update (${data.type}) for conversation ${data.conversationId}`
        );
        
        // Broadcast to all clients in the conversation room AND company room
        // This ensures both ConversationView and ConversationsList components receive the update
        socket.to(`conversation:${data.conversationId}`).emit("conversation:view-update", data);
        
        // Also broadcast to company room so ConversationsList gets updates even when not in specific conversation room
        socket.to("company:dev-company").emit("conversation:view-update", data);
      });

      // Handle conversation read events
      socket.on("conversation:read", (data) => {
        console.log(
          `📖 User ${socket.id} marked conversation ${data.conversationId} as read`
        );

        // Broadcast to all clients in the company room (except sender)
        socket.to("company:dev-company").emit("conversation:read", {
          conversationId: data.conversationId,
          timestamp: data.timestamp,
        });
      });

      socket.on("disconnect", () => {
        console.log("👤 User disconnected:", socket.id);
      });
    });

    // Store io instance globally for access from API routes
    global.socketIO = io;
    console.log("✅ Socket.IO initialized with enhanced room management");
  } catch (error) {
    console.error("❌ Failed to initialize Socket.IO:", error.message);
  }

  // Initialize BullMQ workers using API route
  try {
    console.log("🔄 Initializing BullMQ workers via API...");
    // We'll call the initialization API after server starts
    setTimeout(async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/api/realtime/init",
          {
            method: "POST",
          }
        );
        if (response.ok) {
          console.log("✅ BullMQ workers initialized via API");
        } else {
          console.error(
            "❌ Failed to initialize workers via API:",
            response.status
          );
        }
      } catch (fetchError) {
        console.error(
          "❌ Failed to call worker initialization API:",
          fetchError.message
        );
      }
    }, 2000); // Wait 2 seconds for server to be ready
  } catch (error) {
    console.error("❌ Failed to setup worker initialization:", error.message);
  }

  server
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log("📡 Server running with real-time support");
    });
});
