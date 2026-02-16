# Generate INDUSIA Delivery Documents

Use the **doc-generator** agent to create delivery documents.

Read `.claude/agents/doc-generator.md` for full instructions.

## Key Rule: ALWAYS ask before generating. Never auto-generate without confirmation.

## Flow
1. Ask user which document(s) they want (1-6)
2. Collect: customer name, serial number, any customization
3. Show generation plan → wait for "go"
4. Execute → report results

## Available
1. System Architecture Guide  |  2. Operator Manual  |  3. Maintenance Manual
4. Troubleshooting Guide  |  5. FAT Report ✅  |  6. SAT Report ✅
