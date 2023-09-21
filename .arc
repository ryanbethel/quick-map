@app
begin-app

@static
prune true

@plugins
enhance/arc-plugin-enhance
enhance/styles-cribsheet

@tables
sessions
  _idx *  
  ttl ttl

@aws
runtime nodejs18.x

@begin
appID S9MG8RGW
