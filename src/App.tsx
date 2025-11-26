import "./App.css";
import SequenceDiagram, { SequenceParticipant, SequenceMessage } from "./components/SequenceDiagram";

type AppProps = {
	participants?: SequenceParticipant[];
	messages?: SequenceMessage[];
};

const defaultParticipants: SequenceParticipant[] = [
	{ id: "user-test-service-dlss", name: "user-test-service-dlss" },
	{ id: "browser", name: "Browser" },
	{ id: "browser1", name: "Browser1" },
	{ id: "server", name: "Server" },
	{ id: "server2", name: "Server2" },
	{ id: "cache", name: "Cache" },
	{ id: "queue", name: "Queue" },
	{ id: "db", name: "Database" }
];

const defaultMessages: SequenceMessage[] = ([
	{
		from: "user",
		to: "browser",
		label: "Open /login",
		kind: "async",
		popup: { message: "User navigates to the login page", action: "Navigate", id: "req-001" }
	},
	{
		from: "browser",
		to: "server",
		label: "POST /login",
		kind: "sync",
		popup: { message: "Browser sends login credentials", method: "POST", endpoint: "/login" }
	},
	{
		from: "server",
		to: "db",
		label: "SELECT user",
		kind: "sync",
		popup: { message: "Fetch user by email", query: "SELECT ... FROM users WHERE email=?" }
	},
	{
		from: "db",
		to: "server",
		label: "User row",
		kind: "return",
		popup: { message: "Database returns the user row", rows: "1" }
	},
	{
		from: "server",
		to: "cache",
		label: "SET session",
		kind: "async",
		popup: { message: "Persist session in cache", ttl: "15m" }
	},
	{
		from: "server",
		to: "browser",
		label: "200 OK (JWT)",
		kind: "return",
		popup: { message: "Login successful, JWT issued", status: "200", tokenType: "JWT" }
	},
	{
		from: "browser",
		to: "browser",
		label: "Store token",
		kind: "async",
		popup: { message: "Token saved locally", storage: "localStorage" }
	},
	{
		from: "browser",
		to: "server2",
		label: "GET /profile",
		kind: "sync",
		popup: { message: "Fetch profile details", method: "GET", endpoint: "/profile" }
	},
	{
		from: "server2",
		to: "cache",
		label: "GET session",
		kind: "sync",
		popup: { message: "Check cached session", cacheHit: "true" }
	},
	{
		from: "cache",
		to: "server2",
		label: "Hit",
		kind: "return",
		popup: { message: "Cache hit with session payload" }
	},
	{
		from: "server2",
		to: "db",
		label: "SELECT profile",
		kind: "sync",
		popup: { message: "Load profile from database", query: "SELECT ... FROM profiles WHERE user_id=?" }
	},
	{
		from: "db",
		to: "server2",
		label: "Profile row",
		kind: "return",
		popup: { message: "Profile data returned", rows: "1" }
	},
	{
		from: "server2",
		to: "queue",
		label: "Publish audit evt",
		kind: "async",
		popup: { message: "Publish audit event", topic: "audit.events", partition: "3" }
	},
	{
		from: "server2",
		to: "browser",
		label: "200 OK (HTML)",
		kind: "return",
		popup: { message: "Profile page rendered", status: "200" }
	},
	{
		from: "browser1",
		to: "server2",
		label: "GET /health",
		kind: "sync",
		popup: { message: "Monitoring ping", method: "GET", endpoint: "/health" }
	},
	{
		from: "server2",
		to: "browser1",
		label: "200 OK",
		kind: "return",
		popup: { message: "Health check successful", status: "200" }
	},
	{
		from: "cache",
		to: "server2",
		label: "Hit",
		kind: "return",
		popup: { message: "Cache hit with session payload" }
	},
	{
		from: "server2",
		to: "db",
		label: "SELECT profile",
		kind: "sync",
		popup: { message: "Load profile from database", query: "SELECT ... FROM profiles WHERE user_id=?" }
	},
	{
		from: "db",
		to: "server2",
		label: "Profile row",
		kind: "return",
		popup: { message: "Profile data returned", rows: "1" }
	},
	{
		from: "server2",
		to: "queue",
		label: "Publish audit evt",
		kind: "async",
		popup: { message: "Publish audit event", topic: "audit.events", partition: "3" }
	},
	{
		from: "server2",
		to: "browser",
		label: "200 OK (HTML)",
		kind: "return",
		popup: { message: "Profile page rendered", status: "200" }
	},
	{
		from: "browser1",
		to: "server2",
		label: "GET /health",
		kind: "sync",
		popup: { message: "Monitoring ping", method: "GET", endpoint: "/health" }
	},
	{
		from: "server2",
		to: "browser1",
		label: "200 OK",
		kind: "return",
		popup: { message: "Health check successful", status: "200" }
	},
	{
		from: "cache",
		to: "server2",
		label: "Hit",
		kind: "return",
		popup: { message: "Cache hit with session payload" }
	},
	{
		from: "server2",
		to: "db",
		label: "SELECT profile",
		kind: "sync",
		popup: { message: "Load profile from database", query: "SELECT ... FROM profiles WHERE user_id=?" }
	},
	{
		from: "db",
		to: "server2",
		label: "Profile row",
		kind: "return",
		popup: { message: "Profile data returned", rows: "1" }
	},
	{
		from: "server2",
		to: "queue",
		label: "Publish audit evt",
		kind: "async",
		popup: { message: "Publish audit event", topic: "audit.events", partition: "3" }
	},
	{
		from: "server2",
		to: "browser",
		label: "200 OK (HTML)",
		kind: "return",
		popup: { message: "Profile page rendered", status: "200" }
	},
	{
		from: "browser1",
		to: "server2",
		label: "GET /health",
		kind: "sync",
		popup: { message: "Monitoring ping", method: "GET", endpoint: "/health" }
	},
	{
		from: "server2",
		to: "browser1",
		label: "200 OK",
		kind: "return",
		popup: { message: "Health check successful", status: "200" }
	},
	{
		from: "cache",
		to: "server2",
		label: "Hit",
		kind: "return",
		popup: { message: "Cache hit with session payload" }
	},
	{
		from: "server2",
		to: "db",
		label: "SELECT profile",
		kind: "sync",
		popup: { message: "Load profile from database", query: "SELECT ... FROM profiles WHERE user_id=?" }
	},
	{
		from: "db",
		to: "server2",
		label: "Profile row",
		kind: "return",
		popup: { message: "Profile data returned", rows: "1" }
	},
	{
		from: "server2",
		to: "queue",
		label: "Publish audit evt",
		kind: "async",
		popup: { message: "Publish audit event", topic: "audit.events", partition: "3" }
	},
	{
		from: "server2",
		to: "browser",
		label: "200 OK (HTML)",
		kind: "return",
		popup: { message: "Profile page rendered", status: "200" }
	},
	{
		from: "browser1",
		to: "server2",
		label: "GET /health",
		kind: "sync",
		popup: { message: "Monitoring ping", method: "GET", endpoint: "/health" }
	},
	{
		from: "server2",
		to: "browser1",
		label: "200 OK",
		kind: "return",
		popup: { message: "Health check successful", status: "200" }
	},
	{
		from: "cache",
		to: "server2",
		label: "Hit",
		kind: "return",
		popup: { message: "Cache hit with session payload" }
	},
	{
		from: "server2",
		to: "db",
		label: "SELECT profile",
		kind: "sync",
		popup: { message: "Load profile from database", query: "SELECT ... FROM profiles WHERE user_id=?" }
	},
	{
		from: "db",
		to: "server2",
		label: "Profile row",
		kind: "return",
		popup: { message: "Profile data returned", rows: "1" }
	},
	{
		from: "server2",
		to: "queue",
		label: "Publish audit evt",
		kind: "async",
		popup: { message: "Publish audit event", topic: "audit.events", partition: "3" }
	},
	{
		from: "server2",
		to: "browser",
		label: "200 OK (HTML)",
		kind: "return",
		popup: { message: "Profile page rendered", status: "200" }
	},
	{
		from: "browser1",
		to: "server2",
		label: "GET /health",
		kind: "sync",
		popup: { message: "Monitoring ping", method: "GET", endpoint: "/health" }
	},
	{
		from: "server2",
		to: "browser1",
		label: "200 OK",
		kind: "return",
		popup: { message: "Health check successful", status: "200" }
	}
] as const).map(
	(m, index): SequenceMessage => ({
		...m,
		timestamp: index + 1
	})
);

export default function App({ participants = defaultParticipants, messages = defaultMessages }: AppProps) {
	return (
		<div className="App">
			<h1 className="display-5 fw-semibold mb-1 text-dark">Sequence Diagram</h1>
			<p className="text-secondary mb-3">A minimal, responsive SVG sequence diagram component.</p>
			<div className="diagram-wrapper">
				<div className="diagram-container">
					<SequenceDiagram
						participants={participants}
						messages={messages}
						width="100%"
						height="100%"
					/>
				</div>
			</div>
		</div>
	);
}
