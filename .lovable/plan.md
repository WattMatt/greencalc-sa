

## Fix: AI Tariff PDF Parsing Truncation Issue

### Problem
The Limpopo Province PDF contains **14 municipalities** across 19 pages, but the parsing engine only extracts 5. The root cause is **aggressive text truncation** in the edge function:

- The PDF vision extraction returns all text successfully
- But the analysis prompt truncates to `extractedText.slice(0, 8000)` characters (line 211)
- The municipality extraction prompt truncates to `extractedText.slice(0, 10000)` characters (line 262)
- 10,000 characters only covers the first ~5 municipalities out of 14

### All 14 Municipalities in the PDF
1. BAPHALABORWA
2. BELABELA
3. BLOUBERG
4. ELIAS MOTSOALEDI
5. EPHRAIM MOGALE
6. GREATER LETABA
7. GREATER TZANEEN
8. LEPHALALE
9. MAKHADO
10. MODIMOLLE-MOOKGOPHOONG
11. MOGALAKWENA
12. MOLEMOLE
13. MUSINA
14. POLOKWANE
15. THABAZIMBI

### Solution

**File: `supabase/functions/process-tariff-file/index.ts`**

1. **Increase text limits for analysis and municipality extraction prompts**
   - Analysis prompt: increase from `slice(0, 8000)` to `slice(0, 50000)` -- Gemini Flash supports 1M token context
   - Municipality extraction prompt: increase from `slice(0, 10000)` to `slice(0, 50000)`
   - These are lightweight extraction tasks; the model can handle much larger inputs

2. **Improve the municipality extraction strategy for PDFs**
   - Instead of sending the full text to AI and asking it to find municipality names, use a two-pass approach:
     - First pass: Use a regex/heuristic to find lines matching the pattern `MUNICIPALITY_NAME - XX.XX%` or `MUNICIPALITY_NAME XX.XX%` (the consistent format in SA tariff PDFs)
     - Fall back to the AI extraction if the regex finds nothing
   - This is faster, cheaper, and more reliable than relying on AI for a simple pattern match

3. **Add the sampleText field to include more data**
   - Increase `extractedText.slice(0, 2000)` on the response sampleText to `slice(0, 5000)` so the UI preview shows more context

### Technical Details

The regex pattern for SA tariff PDFs would be:
```
/^([A-Z][A-Z\s\-]+?)\s*[-–]\s*\d+[\.,]\d+%/gm
```

This matches lines like:
- `BAPHALABORWA - 14.59%`
- `MODIMOLLE-MOOKGOPHOONG LIM 368 - 14.59%`
- `MUSINA -14.59%`
- `POLOKWANE 14.59%` (no dash variant -- needs a second pattern)

For the no-dash variant:
```
/^([A-Z][A-Z\s\-]+?)\s+\d+[\.,]\d+%/gm
```

Both patterns will be tried, and the union of results used. The AI fallback remains for non-standard formats.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/process-tariff-file/index.ts` | Increase text slice limits, add regex-based municipality detection for PDFs, increase sampleText limit |

