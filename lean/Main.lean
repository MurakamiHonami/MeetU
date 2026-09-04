import MeetUExchange.ExportTests

def main (args : List String) : IO UInt32 := do
  let out := args.headD "fixtures/cycle-cover.json"
  IO.FS.writeFile out MeetUExchange.ExportTests.jsonString
  IO.println s!"wrote {out}"
  return 0
