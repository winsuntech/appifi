var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs")

http.createServer(function(request, response) {
    if (path.normalize(decodeURI(request.url)) !== decodeURI(request.url)) {
        response.statusCode = 403;
        response.end();
        return;
    }

  var uri = url.parse(request.url).pathname
  var filename = path.join(process.cwd(), 'coverage', 'lcov-report', uri)

  fs.stat(filename, (err, stats) => {
    if(err) {
      response.writeHead(404, {"Content-Type": "text/plain"})
      response.write("404 Not Found\n")
      response.end()
      return
    }

    if (stats.isDirectory()) 
      filename = path.join(filename, 'index.html')

    fs.readFile(filename, "binary", (err, file) => {
      if(err) {        
        response.writeHead(500, {"Content-Type": "text/plain"})
        response.write(err + "\n")
        response.end()
        return
      }

      response.writeHead(200)
      response.write(file, "binary")
      response.end()
    })
  })
}).listen(8888)


