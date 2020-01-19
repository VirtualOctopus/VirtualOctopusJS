import * as command from "@oclif/command";
import * as flush from "@oclif/command/flush";
import * as handle from "@oclif/errors/handle";


(async (): Promise<void> => {
    try {
        flush(await command.run());
    } catch (error) {
        handle(error);
    }
})();


